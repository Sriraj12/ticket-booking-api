const prisma = require("../config/prisma");
const { BookingStatus, PaymentStatus, ApprovalStatus } = require("@prisma/client");

exports.createTheater = async (req, res) => {

    try {
        const { theater_name, location, city, state } = req.body;

        const theater = await prisma.theater.create({
            data: {
                theater_name,
                location,
                city,
                state,
                seller_id: req.user.id
            }
        });

        res.json({
            message: "Theater created",
            theater
        });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.createMovie = async (req, res) => {
    try {
        const {
            title,
            language,
            duration,
            genre,
            release_date,
            poster_url,
            trailer_url,
            is_active
        } = req.body;

        if(!title || !language || !duration || !genre || !release_date) {
            return res.status(400).json({
                message: "title, language, duration, genre and release_date are required"
            });
        }
        

        const movie = await prisma.movie.create({
            data: {
                title,
                language,
                duration: Number(duration),
                genre,
                release_date: new Date(release_date),
                poster_url,
                trailer_url,
                is_active: is_active ?? true
            }
        });

        res.json({
            message: "Movie created",
            movie
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

exports.createScreen = async (req, res) => {

    try {
        const { screen_name, total_seats, theater_id } = req.body;

        const screen = await prisma.screen.create({
            data: {
                screen_name,
                total_seats,
                theater_id
            }
        });

        res.json({
            message: "Screen created",
            screen
        });

    } catch (error) {
        res.status(500).json({ message: "Server error" });
    }
};

exports.createShow = async (req, res) => {
    try {
        const {
            movie_id,
            theater_id,
            screen_id,
            show_date,
            start_time,
            end_time,
            base_price
        } = req.body;

        if (
            !movie_id ||
            !theater_id ||
            !screen_id ||
            !show_date ||
            !start_time ||
            !end_time ||
            !base_price
        ) {
            return res.status(400).json({
                message: "All required fields must be provided"
            });
        }

        const movieId = Number(movie_id);
        const theaterId = Number(theater_id);
        const screenId = Number(screen_id);
        const basePrice = Number(base_price);

        const showDateObj = new Date(show_date);

        const startDateTime = new Date(`${show_date}T${start_time}:00`);
        const endDateTime = new Date(`${show_date}T${end_time}:00`);

        if (
            isNaN(showDateObj.getTime()) ||
            isNaN(startDateTime.getTime()) ||
            isNaN(endDateTime.getTime())
        ) {
            return res.status(400).json({
                message: "Invalid date or time format"
            });
        }

        if (startDateTime >= endDateTime) {
            return res.status(400).json({
                message: "End time must be greater than start time"
            });
        }

        const [movie, theater, screen] = await Promise.all([
            prisma.movie.findUnique({
                where: { id: movieId }
            }),
            prisma.theater.findUnique({
                where: { id: theaterId }
            }),
            prisma.screen.findUnique({
                where: { id: screenId }
            })
        ]);

        if (!movie) {
            return res.status(404).json({
                message: "Movie not found"
            });
        }

        if (!theater) {
            return res.status(404).json({
                message: "Theater not found"
            });
        }

        if (!screen) {
            return res.status(404).json({
                message: "Screen not found"
            });
        }

        if (screen.theater_id !== theaterId) {
            return res.status(400).json({
                message: "Selected screen does not belong to this theater"
            });
        }

        const existingShow = await prisma.show.findFirst({
            where: {
                screen_id: screenId,
                show_date: showDateObj,
                OR: [
                    {
                        start_time: {
                            lt: endDateTime
                        },
                        end_time: {
                            gt: startDateTime
                        }
                    }
                ]
            }
        });

        if (existingShow) {
            return res.status(400).json({
                message: "Another show already exists in this time slot for this screen"
            });
        }

        const show = await prisma.show.create({
            data: {
                movie_id: movieId,
                theater_id: theaterId,
                screen_id: screenId,
                show_date: showDateObj,
                start_time: startDateTime,
                end_time: endDateTime,
                base_price: basePrice,
                is_active: true
            }
        });

        return res.status(201).json({
            message: "Show created successfully",
            show
        });

    } catch (error) {
        console.error("SHOW CREATE ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

exports.createSeats = async (req, res) => {
    try {
        const {
            screen_id,
            rows,
            seats_per_row,
            seat_type,
            price
        } = req.body;

        if (
            !screen_id ||
            !rows ||
            !Array.isArray(rows) ||
            rows.length === 0 ||
            !seats_per_row ||
            !seat_type ||
            !price
        ) {
            return res.status(400).json({
                message: "All required fields must be provided"
            });
        }

        const screenId = Number(screen_id);
        const seatsPerRow = Number(seats_per_row);
        const seatPrice = Number(price);

        const screen = await prisma.screen.findUnique({
            where: {
                id: screenId
            }
        });

        if (!screen) {
            return res.status(404).json({
                message: "Screen not found"
            });
        }

        const existingSeats = await prisma.seat.findFirst({
            where: {
                screen_id: screenId
            }
        });

        if (existingSeats) {
            return res.status(400).json({
                message: "Seats already created for this screen"
            });
        }

        const seatsData = [];

        for (const row of rows) {
            for (let i = 1; i <= seatsPerRow; i++) {
                seatsData.push({
                    screen_id: screenId,
                    seat_number: `${row}${i}`,
                    seat_type,
                    price: seatPrice,
                    is_active: true
                });
            }
        }

        await prisma.seat.createMany({
            data: seatsData
        });

        return res.status(201).json({
            message: "Seats created successfully",
            totalSeatsCreated: seatsData.length
        });

    } catch (error) {
        console.error("CREATE SEATS ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

exports.getAvailableSeats = async (req, res) => {
    try {
        const { showId } = req.params;

        if (!showId) {
            return res.status(400).json({
                message: "Show ID is required"
            });
        }

        const show_id = Number(showId);

        const show = await prisma.show.findUnique({
            where: {
                id: show_id
            }
        });

        if (!show) {
            return res.status(404).json({
                message: "Show not found"
            });
        }

        const allSeats = await prisma.seat.findMany({
            where: {
                screen_id: show.screen_id,
                is_active: true
            },
            select: {
                id: true,
                seat_number: true
            }
        });

        const bookedSeats = await prisma.bookingSeat.findMany({
            where: {
                show_id: show_id
            },
            select: {
                seat_id: true
            }
        });

        const bookedSeatIds = bookedSeats.map(
            (seat) => seat.seat_id
        );

        const lockedSeats = await prisma.seatLock.findMany({
            where: {
                show_id: show_id,
                expires_at: {
                    gt: new Date()
                }
            },
            select: {
                seat_id: true
            }
        });

        const lockedSeatIds = lockedSeats.map(
            (seat) => seat.seat_id
        );

        const available = [];
        const booked = [];
        const locked = [];

        for (const seat of allSeats) {
            if (bookedSeatIds.includes(seat.id)) {
                booked.push(seat.seat_number);
            } else if (lockedSeatIds.includes(seat.id)) {
                locked.push(seat.seat_number);
            } else {
                available.push(seat.seat_number);
            }
        }

        return res.status(200).json({
            message: "Seat availability fetched successfully",
            available,
            booked,
            locked
        });

    } catch (error) {
        console.error("GET AVAILABLE SEATS ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

exports.lockSeats = async (req, res) => {
  try {
    const userId = req.user.id;
    const { show_id, seat_ids } = req.body;

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    // 1. Check already booked
    const alreadyBooked = await prisma.bookingSeat.findMany({
      where: {
        show_id,
        seat_id: { in: seat_ids }
      }
    });

    if (alreadyBooked.length > 0) {
      return res.status(400).json({
        message: "Some seats already booked"
      });
    }

    // 2. Check locked (not expired)
    const alreadyLocked = await prisma.seatLock.findMany({
      where: {
        show_id,
        seat_id: { in: seat_ids },
        expires_at: {
          gt: new Date()
        }
      }
    });

    if (alreadyLocked.length > 0) {
      return res.status(400).json({
        message: "Some seats already locked"
      });
    }

    // 3. Create locks
    const locks = seat_ids.map(seatId => ({
      user_id: userId,
      show_id,
      seat_id: seatId,
      expires_at: expiresAt
    }));

    await prisma.seatLock.createMany({
      data: locks,
      skipDuplicates: true
    });

    res.json({
      message: "Seats locked successfully",
      expires_at: expiresAt
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

// exports.lockSeats = async (req, res) => {
//     try {
//         const {
//             user_id,
//             show_id,
//             seat_ids
//         } = req.body;

//         if (
//             !user_id ||
//             !show_id ||
//             !seat_ids ||
//             !Array.isArray(seat_ids) ||
//             seat_ids.length === 0
//         ) {
//             return res.status(400).json({
//                 message: "user_id, show_id and seat_ids are required"
//             });
//         }

//         const userId = Number(user_id);
//         const showId = Number(show_id);
//         const seatIds = seat_ids.map(Number);

//         const [user, show] = await Promise.all([
//             prisma.user.findUnique({
//                 where: { id: userId }
//             }),
//             prisma.show.findUnique({
//                 where: { id: showId }
//             })
//         ]);

//         if (!user) {
//             return res.status(404).json({
//                 message: "User not found"
//             });
//         }

//         if (!show) {
//             return res.status(404).json({
//                 message: "Show not found"
//             });
//         }

//         const alreadyBooked = await prisma.bookingSeat.findMany({
//             where: {
//                 show_id: showId,
//                 seat_id: {
//                     in: seatIds
//                 }
//             }
//         });

//         if (alreadyBooked.length > 0) {
//             return res.status(400).json({
//                 message: "Some seats are already booked"
//             });
//         }

//         const alreadyLocked = await prisma.seatLock.findMany({
//             where: {
//                 show_id: showId,
//                 seat_id: {
//                     in: seatIds
//                 },
//                 expires_at: {
//                     gt: new Date()
//                 }
//             }
//         });

//         if (alreadyLocked.length > 0) {
//             return res.status(400).json({
//                 message: "Some seats are already locked"
//             });
//         }



//         const expiresAt = new Date(
//             Date.now() + 5 * 60 * 1000
//         );

//         const lockData = seatIds.map((seatId) => ({
//             user_id: userId,
//             show_id: showId,
//             seat_id: seatId,
//             expires_at: expiresAt
//         }));

//         await prisma.seatLock.createMany({
//             data: lockData
//         });



//         return res.status(201).json({
//             message: "Seats locked successfully",
//             expires_at: expiresAt
//         });

//     } catch (error) {
//         console.error("LOCK SEATS ERROR:", error);

//         return res.status(500).json({
//             message: "Server error",
//             error: error.message
//         });
//     }
// };

exports.getSellerDashboard = async (req, res) => {
    try{
        const sellerId = req.user.id;

        const user = await prisma.user.findUnique({
            where: {
                id: sellerId
            }
        });

        const role = await prisma.role.findUnique({
            where: {
                id: user.role_id
            }
        });

        if (role.role_name !== "seller") {
            return res.status(403).json({
                message: "Access denied"
            });
        }
        
        const [totalTheaters, totalScreens, totalShows, totalBookings, revenueResult, recentBookings] = await Promise.all([
            prisma.theater.count({
                where: {
                    seller_id: sellerId
                }
            }),
            prisma.screen.count({
                where: {
                    theater: {
                        seller_id: sellerId
                    }
                }
            }),
            prisma.show.count({
                where: {
                    theater: {
                        seller_id: sellerId
                    }
                }
            }),
            prisma.booking.count({
                where: {
                    booking_status: BookingStatus.CONFIRMED,
                    show: {
                        theater: {
                        seller_id: sellerId
                        }
                    }
                }
            }),
            prisma.booking.aggregate({
                where: {
                    booking_status: BookingStatus.CONFIRMED,
                    payment_status: PaymentStatus.SUCCESS,
                    show: {
                        theater: {
                        seller_id: sellerId
                        }
                    }
                },
                _sum: {
                    total_amount: true
                }
            }),
            prisma.booking.findMany({
                where: {
                    show: {
                        theater: {
                        seller_id: sellerId
                        }
                    }
                },
                orderBy: {
                    booked_at: "desc"
                },
                take: 5,
                include: {
                    user: {
                        select: {
                        name: true,
                        email: true
                        }
                    },
                    show: {
                        include: {
                        movie: {
                            select: {
                            title: true
                            }
                        },
                        theater: {
                            select: {
                            theater_name: true
                            }
                        }
                        }
                    }
                }
            })
        ]);

        const dashboard = {
            total_theaters: totalTheaters,
            total_screens: totalScreens,
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
            message: "Seller dashboard fetched successfully",
            dashboard
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}

exports.getAllMovies = async (req, res) => {
    try{

        const allMovies = await prisma.movie.findMany();

        res.json({
            message: "success",
            allMovies
        });

    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
}

exports.updateTheMovieStatus = async (req, res) => {
    try{
        const movieId = Number(req.params.id);

        const movie = await prisma.movie.findFirst({
            where: {
                id: movieId
            }
        });

        if(!movie) {
            return res.status(400).json({
                message: "The selected movie is not available."
            });
        } 

        const { is_active } = req.body;

        await prisma.movie.update({
            where: {
                id: movieId
            },
            data: {
                is_active: is_active
            }
        })

        return res.status(200).json({
            message: `${movie.title} is activated successfully.`
        })

    }
    catch(error) {
        console.error(error);
        return res.status(500).json({
            message: "unable to update the movie status.",
            error: error
        })
    }
}