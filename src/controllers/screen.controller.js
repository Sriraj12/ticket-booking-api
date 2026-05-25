const { PrismaClient } = require("@prisma/client");
const prisma = require("../config/prisma");

exports.createScreen = async (req, res) => {
    try {
        const {
            screen_name,
            total_seats,
            theater_id,
            rows, // This should be your array like ["A", "B", "C"]
            seats_per_row,
            premium_rows = [],
            recliner_rows = [],
        } = req.body;

        // 1. Verify theater ownership
        const theater = await prisma.theater.findFirst({
            where: {
                id: theater_id,
                seller_id: req.user.id,
            },
        });

        if (!theater) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized or theater does not exist",
            });
        }

        // 2. Create the screen
        const screen = await prisma.screen.create({
            data: {
                screen_name,
                total_seats: Number(total_seats),
                theater_id,
            },
        });

        // 3. Generate the seats array
        const seats = [];

        // Note: rows is expected to be an array from your previous logic (e.g., ["A", "B"])
        for (const row of rows) {
            for (let i = 1; i <= seats_per_row; i++) {
                let seatType = "REGULAR";

                // Check for Premium or Recliner status
                if (premium_rows.includes(row)) {
                    seatType = "PREMIUM";
                } else if (recliner_rows.includes(row)) {
                    // Used else-if so a row isn't accidentally both
                    seatType = "RECLINER";
                }

                seats.push({
                    row_name: row,
                    seat_number: String(i),
                    seat_type: seatType,
                    screen_id: screen.id, // Fixed: use screen.id
                });
            }
        }

        // 4. Bulk insert seats
        await prisma.seat.createMany({
            data: seats,
        });

        return res.status(201).json({
            success: true,
            message: "Screen and seats created successfully",
            screen,
        });

    } catch (error) {
        console.error("CREATE_SCREEN_ERROR:", error); // Use console.error for better logs
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message // Helpful for debugging, remove in production
        });
    }
};

exports.getScreensByTheater = async (req, res) => {
    try {
        const { theaterId } = req.params;

        // Verify ownership
        const theater = await prisma.theater.findFirst({
            where: {
                id: Number(theaterId),
                seller_id: req.user.id,
            },
        });

        if (!theater) {
            return res.status(403).json({
                success: false,
                message: "Unauthorized access",
            });
        }

        const screens = await prisma.screen.findMany({
            where: {
                theater_id: Number(theaterId),
            },
            include: {
                seats: true,
            },
        });

        return res.json({
            success: true,
            screens,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to fetch screens",
        });
    }
};