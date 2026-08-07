const { PrismaClient } = require("@prisma/client");
const prisma = require("../config/prisma");

exports.generateSeats = async (req, res) => {
    try {
        const { screenId } = req.params;

        const {
            rows,
            seats_per_row,
            premium_rows = [],
            recliner_rows = [],
        } = req.body;

        // Check screen exists
        const screen = await prisma.screen.findUnique({
            where: {
                id: Number(screenId),
            },
            include: {
                theater: true,
            },
        });

        if (!screen) {
            return res.status(404).json({
                success: false,
                message: "Screen not found",
            });
        }

        // Verify ownership
        if (screen.theater.seller_id !== req.user.id) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized theater access",
            });
        }

        const existingSeats = await prisma.seat.count({
            where: {
                screen_id: Number(screenId),
            },
        });

        if (existingSeats > 0) {
            return res.status(400).json({
                success: false,
                message: "Seats already generated for this screen",
            });
        }

        const seats = [];

        for (const row of rows) {
            for (let i = 1; i <= seats_per_row; i++) {

                let seatType = "REGULAR";

                if (premium_rows.includes(row)) {
                    seatType = "PREMIUM";
                }

                if (recliner_rows.includes(row)) {
                    seatType = "RECLINER";
                }

                seats.push({
                    row_name: row,
                    seat_number: String(i),
                    seat_type: seatType,
                    screen_id: Number(screenId),
                });
            }
        }

        await prisma.seat.createMany({
            data: seats,
        });

        return res.status(201).json({
            success: true,
            message: "Seats generated successfully",
            totalSeats: seats.length,
        });

    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: "Failed to generate seats",
        });
    }
};

exports.getSeatsByScreen = async (req, res) => {
    try {
        const { screenId } = req.params;

        const seats = await prisma.seat.findMany({
            where: {
                screen_id: Number(screenId),
            },
            orderBy: [
                {
                    row_name: "asc",
                },
                {
                    seat_number: "asc",
                },
            ],
        });

        return res.json({
            success: true,
            seats,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch seats",
        });
    }
};