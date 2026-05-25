const { PrismaClient } = require("@prisma/client");
const prisma = require("../config/prisma");

exports.createShow = async (req, res) => {
    try {
        // 1. Explicitly parse numbers to prevent Prisma type crashes
        const movie_id = Number(req.body.movie_id);
        const theater_id = Number(req.body.theater_id);
        const screen_id = Number(req.body.screen_id);
        
        const {
            show_start_time,
            show_end_time,
            base_price,
            premium_ticket_price,
            recliner_ticket_price
        } = req.body;

        // Ensure we got valid numeric inputs after conversion
        if (isNaN(movie_id) || isNaN(theater_id) || isNaN(screen_id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid type provided for movie_id, theater_id, or screen_id. Must be numeric.",
            });
        }

        // 2. Verify screen belongs to seller
        const screen = await prisma.screen.findFirst({
            where: {
                id: screen_id,
                theater: {
                    seller_id: Number(req.user.id),
                },
            },
        });

        if (!screen) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized screen access or screen does not exist",
            });
        }

        if (screen.theater_id !== theater_id) {
            return res.status(400).json({
                success: false,
                message: "Screen does not belong to the specified theater",
            });
        }

        // 3. Prevent overlapping shows
        const start = new Date(show_start_time);
        const end = new Date(show_end_time);

        const overlappingShow = await prisma.show.findFirst({
            where: {
                screen_id,
                AND: [
                    { show_start_time: { lt: end } },
                    { show_end_time: { gt: start } },
                ],
            },
        });

        if (overlappingShow) {
            return res.status(400).json({
                success: false,
                message: "Show timing overlaps with an existing show on this screen",
            });
        }

        // 4. Atomic Execution: Create show and update seats using strict enum mappings
        const result = await prisma.$transaction(async (tx) => {
            const newShow = await tx.show.create({
                data: {
                    movie_id,
                    theater_id,
                    screen_id,
                    show_start_time: start,
                    show_end_time: end,
                    base_price: Number(base_price),
                },
            });

            // Enforce explicit float conversions and match exact uppercase schema enums
            const regularUpdate = await tx.seat.updateMany({
                where: { screen_id: screen_id, seat_type: "REGULAR" },
                data: { price: parseFloat(base_price) }
            });

            const reclinerUpdate = await tx.seat.updateMany({
                where: { screen_id: screen_id, seat_type: "RECLINER" },
                data: { price: parseFloat(recliner_ticket_price) }
            });

            const premiumUpdate = await tx.seat.updateMany({
                where: { screen_id: screen_id, seat_type: "PREMIUM" },
                data: { price: parseFloat(premium_ticket_price) }
            });

            // Senior Debug Log: Print out exactly how many seats matched and updated in terminal
            console.log(`Seat updates logs -> Regular: ${regularUpdate.count}, Recliner: ${reclinerUpdate.count}, Premium: ${premiumUpdate.count}`);

            return newShow;
        });

        return res.status(201).json({
            success: true,
            show: result,
        });

    } catch (error) {
        console.error("Error creating show or updating seats:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create show due to internal server validation",
            systemError: error.message 
        });
    }
};

exports.getSellerShows = async (req, res) => {
    try {

        const shows = await prisma.show.findMany({
            where: {
                theater: {
                    seller_id: req.user.id,
                },
            },

            include: {
                movie: true,
                theater: true,
                screen: true,
            },

            orderBy: {
                show_start_time: "asc",
            },
        });

        return res.json({
            success: true,
            shows,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch shows",
        });
    }
};

exports.deleteShow = async (req, res) => {
    try {
        const { showId } = req.params;
        const show_id = Number(showId);
        const sellerId = Number(req.user.id);

        if (isNaN(show_id) || isNaN(sellerId)) {
            return res.status(400).json({ success: false, message: "Invalid parameters provided" });
        }

        // 1. Verify show ownership and existence
        const show = await prisma.show.findFirst({
            where: {
                id: show_id,
                theater: { seller_id: sellerId },
            },
        });

        if (!show) {
            return res.status(404).json({
                success: false,
                message: "Show not found or unauthorized access",
            });
        }

        // 2. Clear out all dependent layers bottom-up within an isolated database Transaction
        await prisma.$transaction(async (tx) => {
            // Step A: Clear out revenues tied to bookings of this show
            await tx.sellerRevenue.deleteMany({ where: { show_id: show_id } });

            // Step B: Clear individual seat configurations linked to bookings of this show
            await tx.bookingSeat.deleteMany({ where: { show_id: show_id } });

            // Step C: Clear any payments pointing to bookings of this show
            await tx.payment.deleteMany({
                where: {
                    booking: { show_id: show_id }
                }
            });

            // Step D: Clear out any active or historical seat reservations/locks
            await tx.seatLock.deleteMany({ where: { show_id: show_id } });

            // Step E: Clear the actual booking documents themselves
            await tx.booking.deleteMany({ where: { show_id: show_id } });

            // Step F: Safe to wipe the core show row
            await tx.show.delete({ where: { id: show_id } });
        });

        return res.json({
            success: true,
            message: "Show and all corresponding transactional records cleared successfully",
        });

    } catch (error) {
        console.error("Hard Delete Failure Details:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to cleanly execute show removal chain",
            systemError: error.message
        });
    }
};