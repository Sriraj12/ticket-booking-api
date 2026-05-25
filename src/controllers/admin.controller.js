const prisma = require("../config/prisma");
const { BookingStatus, PaymentStatus, ApprovalStatus } = require("@prisma/client");

exports.getAdminDashboard = async (req, res) => {
    try {

        const isAdmin = req.user.role_id === 1;

        if (!isAdmin) {
            return res.status(403).json({ message: "Admin only" });
        }

        const [
            totalUsers,
            totalSellers,
            totalTheaters,
            totalMovies,
            totalShows,
            totalBookings,
            revenueResult,
            recentBookings
        ] = await Promise.all([
            prisma.user.count({ where: { role_id: 3 } }),
            prisma.user.count({ where: { role_id: 2 } }),
            prisma.theater.count(),
            prisma.movie.count(),
            prisma.show.count(),
            prisma.booking.count(),
            prisma.booking.aggregate({
                where: {
                    booking_status: BookingStatus.CONFIRMED,
                    payment_status: PaymentStatus.SUCCESS
                },
                _sum: {
                    total_amount: true
                }
            }),
            prisma.booking.findMany({
                orderBy: { booked_at: "desc" },
                take: 5,
                include: {
                    show: {
                        include: {
                            movie: true,
                            theater: true
                        }
                    },
                    user: true
                }
            })
        ])

        const dashboard = {
            total_users: totalUsers,
            total_sellers: totalSellers,
            total_theaters: totalTheaters,
            total_movies: totalMovies,
            total_shows: totalShows,
            total_bookings: totalBookings,
            total_revenue: revenueResult._sum.total_amount || 0,

            recent_bookings: recentBookings.map((booking) => ({
                booking_id: booking.id,
                customer_name: booking.user.name,
                customer_email: booking.user.email,
                movie: booking.show.movie.title,
                theater: booking.show.theater.theater_name,
                total_amount: booking.total_amount,
                booking_status: booking.booking_status,
                payment_status: booking.payment_status,
                booked_at: booking.booked_at
            }))
        };

        return res.status(200).json({
            message: "Admin dashboard fetched successfully",
            data: dashboard
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
}

exports.getAllTheaters = async (req, res) => {
    try {
        const theaters = await prisma.theater.findMany({
            include: {
                seller: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            },
            orderBy: {
                created_at: "desc"
            }
        });

        return res.status(200).json({
            message: "Theaters fetched successfully",
            theaters
        });

    } catch (error) {
        console.error("Error fetching theaters:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch theaters",
            systemError: error.message 
        });
    }
};

exports.updateTheaterApproval = async (req, res) => {
    try {
        const {
            theater_id,
            approval_status
        } = req.body;

        if (!theater_id || !approval_status) {
            return res.status(400).json({
                message: "theater_id and approval_status are required"
            });
        }

        const theaterId = Number(theater_id);

        if (isNaN(theaterId)) {
            return res.status(400).json({
                message: "Invalid theater_id"
            });
        }

        const allowedStatuses = [
            ApprovalStatus.APPROVED,
            ApprovalStatus.REJECTED
        ];

        if (!allowedStatuses.includes(approval_status)) {
            return res.status(400).json({
                message: "approval_status must be APPROVED or REJECTED"
            });
        }

        const theater = await prisma.theater.findUnique({
            where: {
                id: theaterId
            }
        });

        if (!theater) {
            return res.status(404).json({
                message: "Theater not found"
            });
        }

        // if (theater.approval_status !== ApprovalStatus.PENDING) {
        //     return res.status(400).json({
        //         message: `Theater already ${theater.approval_status}`
        //     });
        // }

        const updatedTheater = await prisma.theater.update({
            where: {
                id: theaterId
            },
            data: {
                approval_status,
                is_active: approval_status === ApprovalStatus.APPROVED
            }
        });

        return res.status(200).json({
            message: `Theater ${approval_status.toLowerCase()} successfully`,
            theater: updatedTheater
        });

    } catch (error) {
        console.error("THEATER APPROVAL ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};