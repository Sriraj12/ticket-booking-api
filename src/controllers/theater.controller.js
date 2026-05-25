const { PrismaClient } = require("@prisma/client");
const prisma = require("../config/prisma");

exports.createTheater = async (req, res) => {
    try {
        const {
            theater_name,
            location,
            city,
            state,
        } = req.body;

        const theater = await prisma.theater.create({
            data: {
                theater_name,
                location,
                city,
                state,
                seller_id: req.user.id,
            },
        });

        return res.status(201).json({
            success: true,
            theater,
        });
    } catch (error) {
        console.log(error);

        return res.status(500).json({
            success: false,
            message: "Failed to create theater",
        });
    }
};

exports.getSellerTheaters = async (req, res) => {
  try {

    const theaters = await prisma.theater.findMany({
      where: {
        seller_id: req.user.id,
      },

      include: {
        screens: true,

        shows: {
          include: {
            bookings: true,
          },
          where: {
            show_start_time: {
              gte: new Date()
            }
          }
        },
      },

      orderBy: {
        created_at: "desc",
      },
    });

    // Calculate revenue and booking details
    const theatersWithDetails = theaters.map((theater) => {

      let totalRevenue = 0;
      let totalBookings = 0;

      theater.shows.forEach((show) => {

        show.bookings.forEach((booking) => {

          if (booking.payment_status === "SUCCESS") {
            totalRevenue += booking.total_amount;
            totalBookings++;
          }

        });

      });

      return {
        id: theater.id,
        theater_name: theater.theater_name,
        location: theater.location,
        city: theater.city,
        state: theater.state,

        approval_status: theater.approval_status,
        is_active: theater.is_active,

        total_screens: theater.screens.length,
        total_shows: theater.shows.length,
        total_bookings: totalBookings,
        total_revenue: totalRevenue,

        created_at: theater.created_at,
        updated_at: theater.updated_at,

        screens: theater.screens,
      };
    });

    return res.status(200).json({
      success: true,
      theaters: theatersWithDetails,
    });

  } catch (error) {

    console.error("Get Seller Theaters Error:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to fetch theaters",
      error: error.message,
    });
  }
};