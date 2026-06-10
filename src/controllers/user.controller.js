const { PrismaClient, BookingStatus, PaymentStatus } = require("@prisma/client");
const prisma = require("../config/prisma");
const QRCode = require("qrcode");
const jwt = require("jsonwebtoken");
const PDFDocument = require("pdfkit");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const http = require("http");
const https = require("https");
const { bookingLogger, paymentLogger } = require("../utils/logger");

const fetchImageBuffer = (url, redirects = 0) => {
    return new Promise((resolve, reject) => {
        if (!url) return resolve(null);

        // Support data URIs directly
        if (url.startsWith("data:")) {
            try {
                const base64 = url.split(",")[1];
                return resolve(Buffer.from(base64, "base64"));
            } catch (e) {
                return reject(new Error("Invalid data URI for image"));
            }
        }

        if (redirects > 5) return reject(new Error("Too many redirects while fetching image"));

        const client = url.startsWith("https") ? https : http;

        const defaultHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Accept": "image/*,*/*;q=0.8",
            "Referer": "https://en.wikipedia.org/"
        };

        const req = client.get(url, { headers: defaultHeaders }, (res) => {
            // Follow redirects
            if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
                const location = res.headers.location;
                if (!location) return reject(new Error("Redirect location missing"));
                return resolve(fetchImageBuffer(location, redirects + 1));
            }

            if (res.statusCode === 403 && redirects === 0) {
                // Retry once with a safer referer (some CDNs block hotlinking)
                console.warn(`fetchImageBuffer: 403 for ${url}, retrying with alternate referer`);
                return resolve(fetchImageBuffer(url, redirects + 1));
            }

            if (res.statusCode !== 200) {
                // Not fatal — resolve null so PDF generation continues
                console.warn(`fetchImageBuffer: got status ${res.statusCode} for ${url}`);
                return resolve(null);
            }

            const contentType = (res.headers["content-type"] || "").toLowerCase();

            const chunks = [];
            res.on("data", (chunk) => chunks.push(chunk));
            res.on("end", () => {
                const buffer = Buffer.concat(chunks);
                if (contentType && !contentType.startsWith("image/")) {
                    console.warn(`fetchImageBuffer: content-type ${contentType} for ${url} (not an image)`);
                }
                resolve(buffer);
            });
        });

        req.on("error", (err) => {
            console.warn(`fetchImageBuffer error for ${url}:`, err.message);
            resolve(null);
        });

        // timeout safety
        req.setTimeout(5000, () => {
            req.abort();
            console.warn(`fetchImageBuffer timeout for ${url}`);
            resolve(null);
        });
    });
};

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

exports.getMovies = async (req, res) => {
    try {
        const movies = await prisma.movie.findMany({
            where: {
                is_active: true
            }
        });

        return res.status(200).json({
            message: "Movies fetched successfully",
            total: movies.length,
            movies
        });
    } catch (error) {
        console.error("GET MOVIES ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
}

exports.getShowsByMovie = async (req, res) => {
    try {
        const movieId = Number(req.params.movieId);
        const { date, city } = req.query;

        if (isNaN(movieId)) {
            return res.status(400).json({
                message: "Invalid movie ID"
            });
        }

        const selectedDate = new Date(date);

        if (!date || isNaN(selectedDate.getTime())) {
            return res.status(400).json({
                message: "Invalid date"
            });
        }

        const startOfDay = new Date(selectedDate);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(selectedDate);
        endOfDay.setHours(23, 59, 59, 999);

        const now = new Date();

        const movie = await prisma.movie.findUnique({
            where: {
                id: movieId
            }
        });

        if (!movie) {
            return res.status(404).json({
                message: "Movie not found"
            });
        }

        const shows = await prisma.show.findMany({
            where: {
                movie_id: movieId,

                show_start_time: {
                    gte:
                        selectedDate.toDateString() === now.toDateString()
                            ? now
                            : startOfDay,
                    lte: endOfDay
                },

                theater: city
                    ? {
                          city: city
                      }
                    : undefined
            },

            include: {
                theater: {
                    select: {
                        theater_name: true,
                        city: true
                    }
                },

                screen: {
                    select: {
                        screen_name: true
                    }
                }
            }
        });

        return res.status(200).json({
            message: "Shows fetched successfully",
            total: shows.length,
            shows,
            movie
        });

    } catch (error) {
        console.error("GET MOVIE SHOWS ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

exports.getSeatsByShow = async (req, res) => {
    try {
        const showId = Number(req.params.showId);

        if (isNaN(showId)) return res.status(400).json({ message: "Invalid show ID" });

        // Single query to get Show, Screen, Movie, and Seats
        const showData = await prisma.show.findUnique({
            where: { id: showId },
            include: {
                movie: { select: { title: true } },
                screen: {
                    include: {
                        seats: {
                            include: {
                                seatLocks: {
                                    where: {
                                        show_id: showId,
                                        expires_at: { gt: new Date() }
                                    }
                                },
                                bookingSeats: {
                                    where: { show_id: showId }
                                }
                            }
                        }
                    }
                }
            }
        });

        if (!showData) return res.status(404).json({ message: "Show not found" });

        return res.status(200).json({
            message: "Seats fetched successfully",
            total: showData.screen.seats.length,
            seats: showData.screen.seats,
            movie: showData.movie
        });

    } catch (error) {
        console.error("GET SEATS ERROR:", error);
        return res.status(500).json({ message: "Server error", error: error.message });
    }
}

exports.getShowDetails = async (req, res) => {
    try {
        const show_id = Number(req.params.showId);

        if (!show_id) {
            return res.status(400).json({
                message: "show_id is required"
            });
        }

        if (isNaN(show_id)) {
            return res.status(400).json({
                message: "Invalid show ID"
            });
        }

        const show = await prisma.show.findUnique({
            where: {
                id: show_id,
            },
            include: {
                movie: true,
                theater: true,
                screen: true
            }
        });

        if (!show) {
            return res.status(404).json({
                message: "Show not found"
            });
        }

        return res.status(200).json({
            message: "Show details fetched successfully",
            show
        });
    } catch (error) {
        console.error("GET SHOW DETAILS ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
}

exports.getSelectedSeatDetails = async (req, res) => {
    try {
        const { show_id, seat_ids } = req.body;

        if (!show_id || !seat_ids || !Array.isArray(seat_ids) || seat_ids.length === 0) {
            return res.status(400).json({
                message: "show_id and seat_ids are required"
            });
        }

        const seatIds = seat_ids.map(Number);

        const seats = await prisma.seat.findMany({
            where: {
                id: { in: seatIds }
            }
        });

        return res.status(200).json({
            message: "Selected seat details fetched successfully",
            seats
        });
    } catch (error) {
        console.error("GET SELECTED SEAT DETAILS ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
}

exports.lockSeats = async (req, res) => {
    try {
        const userId = req.user.id;
        const { show_id, seat_ids } = req.body;
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

        bookingLogger.info("Seats locked", {
            userId: req.user.id,
            show_id,
            seat_ids,
        });


        // 1. Check already booked
        const alreadyBooked = await prisma.bookingSeat.findMany({
            where: {
                show_id: Number(show_id),
                seat_id: { in: seat_ids }
            }
        });

        // console.log("Checking locks for show ID:", show_id, "seat IDs:", seat_ids);

        // console.log("Already booked seats:", alreadyBooked);

        if (alreadyBooked.length > 0) {
            return res.status(400).json({
                message: "Some seats already booked"
            });
        }

        // 2. Check locked (not expired)
        // const alreadyLocked = await prisma.seatLock.findMany({
        //     where: {
        //         show_id: Number(show_id),
        //         seat_id: { in: seat_ids },
        //         expires_at: {
        //             gt: new Date()
        //         }
        //     }
        // });

        // if (alreadyLocked.length > 0) {
        //     return res.status(400).json({
        //         message: "Some seats already locked"
        //     });
        // }

        // 3. Create locks
        const locks = seat_ids.map(seatId => ({
            user_id: Number(userId),
            show_id: Number(show_id),
            seat_id: seatId,
            expires_at: expiresAt
        }));

        await prisma.seatLock.createMany({
            data: locks,
            skipDuplicates: true
        });

        const io = req.app.get("io");

        io.to(`show-${show_id}`).emit("seat-locked", {
            show_id,
            seat_ids
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

exports.getLockedSeats = async (req, res) => {
    try {
        const showId = Number(req.params.showId);

        console.log("Fetching locked seats for show ID:", showId);

        const locks = await prisma.seatLock.findMany({
            where: {
                show_id: Number(showId)
            },
            select: {
                seat_id: true,
                // expires_at: true
            }
        });

        return res.status(200).json({
            message: "Locked seats fetched successfully",
            locked_seats: locks
        });

    } catch (error) {
        console.error("GET LOCKED SEATS ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
}

exports.getBookedSeats = async (req, res) => {
    try {
        const showId = Number(req.params.showId);

        console.log("Fetching booked seats for show ID:", showId);

        const bookedSeats = await prisma.bookingSeat.findMany({
            where: {
                show_id: Number(showId)
            },
            select: {
                seat_id: true
            }
        });

        return res.status(200).json({
            message: "Booked seats fetched successfully",
            booked_seats: bookedSeats
        });

    } catch (error) {
        console.error("GET BOOKED SEATS ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
}

exports.confirmBooking = async (req, res) => {
    try {
        const userId = req.user.id;

        const {
            show_id,
            seat_ids,
            // payment_gateway,
            // transaction_id
        } = req.body;

        const showId = Number(show_id);
        const seatIds = seat_ids.map(id => Number(id));

        if (!showId || seatIds.length === 0) {
            return res.status(400).json({
                message: "Invalid data"
            });
        }

        // 1. Validate seat locks
        const locks = await prisma.seatLock.findMany({
            where: {
                show_id: showId,
                seat_id: { in: seatIds },
                user_id: userId,
                // expires_at: {
                //     gt: new Date()
                // }
            }
        });

        console.log("Validating locks for show ID:", showId, "seat IDs:", seatIds);
        console.log("Found locks:", locks.length);

        if (locks.length !== seatIds.length) {
            return res.status(400).json({
                message: "Some seats are not locked or expired"
            });
        }

        // 2. Prevent duplicate booking
        const alreadyBooked = await prisma.bookingSeat.findMany({
            where: {
                show_id: showId,
                seat_id: { in: seatIds }
            }
        });

        if (alreadyBooked.length > 0) {
            return res.status(400).json({
                message: "Some seats already booked"
            });
        }

        // 3. Get seat prices
        const seats = await prisma.seat.findMany({
            where: {
                id: { in: seatIds }
            }
        });

        const totalAmount = seats.reduce((sum, s) => sum + s.price, 0);

        // 4. Create booking
        const booking = await prisma.booking.create({
            data: {
                user_id: userId,
                show_id: showId,
                total_amount: totalAmount,
                booking_status: "PENDING",
                payment_status: "PENDING"
            }
        });

        // 5. Create booking seats
        await prisma.bookingSeat.createMany({
            data: seats.map(seat => ({
                booking_id: booking.id,
                show_id: showId,
                seat_id: seat.id,
                price: seat.price
            })),
            skipDuplicates: true
        });

        // 6. Delete locks
        await prisma.seatLock.deleteMany({
            where: {
                show_id: showId,
                seat_id: { in: seatIds },
                user_id: userId
            }
        });

        // 7. Create payment
        // await prisma.payment.create({
        //     data: {
        //         booking_id: booking.id,
        //         payment_gateway,
        //         payment_status: "SUCCESS",
        //         transaction_id
        //     }
        // });

        return res.status(200).json({
            message: "Booking confirmed",
            booking_id: booking.id,
            total_amount: totalAmount
        });

    } catch (error) {
        console.error("BOOKING ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

exports.createOrder = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount) {
            return res.status(400).json({
                message: "Amount is required"
            });
        }

        const options = {
            amount: amount * 100, // paise
            currency: "INR",
            receipt: `receipt_${Date.now()}`
        };

        const order = await razorpay.orders.create(options);

        return res.status(200).json({
            message: "Order created",
            order
        });

    } catch (error) {
        console.error("ORDER ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

exports.verifyPayment = async (req, res) => {
    try {
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature,
            booking_id
        } = req.body;



        const body = razorpay_order_id + "|" + razorpay_payment_id;

        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({
                message: "Invalid payment signature"
            });
        }

        // ✅ Payment verified → update booking
        const updatedBooking = await prisma.booking.update({
            where: { id: booking_id },
            data: {
                booking_status: "CONFIRMED",
                payment_status: "SUCCESS"
            }
        });

        // Save payment
        await prisma.payment.create({
            data: {
                booking_id,
                payment_gateway: "Razorpay",
                payment_status: "SUCCESS",
                transaction_id: razorpay_payment_id
            }
        });

        paymentLogger.info("Payment success", {
            booking_id,
            paymentId: razorpay_payment_id,
        });

        return res.status(200).json({
            message: "Payment verified successfully",
            booking: updatedBooking
        });

    } catch (error) {
        console.error("VERIFY ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

exports.getBookingById = async (req, res) => {
    try {
        const bookingId = Number(req.params.id);

        console.log("params:", req.params);

        if (isNaN(bookingId)) {
            return res.status(400).json({
                message: "Invalid booking ID"
            });
        }

        bookingLogger.info("Booking initiated", {
            requestId: req.requestId,
            userId: req.user.id,
            showId: bookingId,
        });

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },

            include: {
                // 👤 User Info
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                },

                // 🎬 Show + Movie + Theater + Screen
                show: {
                    include: {
                        movie: {
                            select: {
                                id: true,
                                title: true,
                                language: true,
                                duration: true,
                                genre: true,
                                poster_url: true
                            }
                        },
                        theater: {
                            select: {
                                id: true,
                                theater_name: true,
                                city: true,
                                state: true,
                                location: true
                            }
                        },
                        screen: {
                            select: {
                                id: true,
                                screen_name: true
                            }
                        }
                    }
                },

                // 💺 Seats
                bookingSeats: {
                    include: {
                        seat: {
                            select: {
                                id: true,
                                seat_number: true,
                                seat_type: true,
                                price: true,
                                row_name: true
                            }
                        }
                    }
                },

                // 💳 Payment
                payments: {
                    select: {
                        id: true,
                        payment_gateway: true,
                        payment_status: true,
                        transaction_id: true,
                        paid_at: true
                    }
                }
            }
        });

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        const response = {
            booking_id: booking.id,
            booking_status: booking.booking_status,
            payment_status: booking.payment_status,
            total_amount: booking.total_amount,
            booked_at: booking.booked_at,

            user: booking.user,

            movie: booking.show.movie,

            theater: booking.show.theater,

            screen: booking.show.screen,

            show: {
                show_id: booking.show.id,
                show_date: booking.show.show_date,
                start_time: booking.show.show_start_time,
                end_time: booking.show.show_end_time
            },

            seats: booking.bookingSeats.map(bs => ({
                seat_id: bs.seat.id,
                seat_number: bs.seat.seat_number,
                seat_type: bs.seat.seat_type,
                price: bs.price,
                row_name: bs.seat.row_name
            })),

            payments: booking.payments
        };

        return res.status(200).json({
            message: "Booking fetched successfully",
            booking: response
        });

    } catch (error) {
        console.error("GET BOOKING ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

exports.unlockSeats = async (req, res) => {
    try {
        const result = await prisma.seatLock.deleteMany({
            where: {
                user_id: Number(req.user.id),
                show_id: Number(req.body.show_id),
            }
        });

        const io = req.app.get("io");

        io.to(`show-${show_id}`).emit("seat-unlocked", {
            show_id,
            seat_ids
        });

        return res.status(200).json({
            message: "Locked seats cleared successfully",
            deletedCount: result.count
        });
    } catch (error) {
        console.error("CLEAR LOCKED SEATS ERROR:", error);
        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
}

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

//         const userDetails = await prisma.user.findUnique({
//             where: { id: Number(user_id) }
//         });

//         if (!userDetails) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         if (userDetails.role_id !== 3) {
//             return res.status(403).json({ message: "Unauthorized" });
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

//         await prisma.seatLock.deleteMany({
//             where: {
//                 expires_at: {
//                     lte: new Date()
//                 }
//             }
//         });

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

// exports.confirmBooking = async (req, res) => {
//     try {
//         const {
//             user_id,
//             show_id,
//             seat_ids,
//             payment_gateway,
//             transaction_id
//         } = req.body;

//         if (
//             !user_id ||
//             !show_id ||
//             !seat_ids ||
//             !Array.isArray(seat_ids) ||
//             seat_ids.length === 0 ||
//             !payment_gateway ||
//             !transaction_id
//         ) {
//             return res.status(400).json({
//                 message: "All required fields must be provided"
//             });
//         }

//         const userDetails = await prisma.user.findUnique({
//             where: { id: Number(user_id) }
//         });

//         if (!userDetails) {
//             return res.status(404).json({ message: "User not found" });
//         }

//         if (userDetails.role_id !== 3) {
//             return res.status(403).json({ message: "Unauthorized" });
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

//         const lockedSeats = await prisma.seatLock.findMany({
//             where: {
//                 user_id: userId,
//                 show_id: showId,
//                 seat_id: {
//                     in: seatIds
//                 },
//                 expires_at: {
//                     gt: new Date()
//                 }
//             }
//         });

//         if (lockedSeats.length !== seatIds.length) {
//             return res.status(400).json({
//                 message: "Some seats are not locked or lock expired"
//             });
//         }

//         const seats = await prisma.seat.findMany({
//             where: {
//                 id: {
//                     in: seatIds
//                 }
//             },
//             select: {
//                 id: true,
//                 price: true
//             }
//         });

//         const totalAmount = seats.reduce(
//             (sum, seat) => sum + seat.price,
//             0
//         );

//         const booking = await prisma.booking.create({
//             data: {
//                 user_id: userId,
//                 show_id: showId,
//                 total_amount: totalAmount,
//                 booking_status: "CONFIRMED",
//                 payment_status: "SUCCESS"
//             }
//         });

//         const bookingSeatData = seatIds.map((seatId) => {
//             const seat = seats.find((s) => s.id === seatId);

//             return {
//                 booking_id: booking.id,
//                 show_id: showId,
//                 seat_id: seatId,
//                 price: seat ? seat.price : show.base_price
//             };
//         });

//         const alreadyBookedSeats = await prisma.bookingSeat.findMany({
//             where: {
//                 show_id,
//                 seat_id: { in: seat_ids }
//             },
//             select: {
//                 seat_id: true
//             }
//         });

//         if (alreadyBookedSeats.length > 0) {
//             return res.status(400).json({
//                 message: "Some seats are already booked",
//                 booked_seats: alreadyBookedSeats.map(s => s.seat_id)
//             });
//         }

//         await prisma.bookingSeat.createMany({
//             data: bookingSeatData
//         });

//         await prisma.payment.create({
//             data: {
//                 booking_id: booking.id,
//                 payment_gateway,
//                 payment_status: "SUCCESS",
//                 transaction_id
//             }
//         });

//         await prisma.seatLock.deleteMany({
//             where: {
//                 user_id: userId,
//                 show_id: showId,
//                 seat_id: {
//                     in: seatIds
//                 }
//             }
//         });

//         return res.status(201).json({
//             message: "Booking confirmed successfully",
//             booking_id: booking.id,
//             total_amount: totalAmount
//         });

//     } catch (error) {
//         console.error("CONFIRM BOOKING ERROR:", error);

//         return res.status(500).json({
//             message: "Server error",
//             error: error.message
//         });
//     }
// };

exports.getBookingHistory = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({
                message: "User ID is required"
            });
        }

        const user_id = Number(userId);

        if (isNaN(user_id)) {
            return res.status(400).json({
                message: "Invalid User ID"
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id: user_id
            }
        });

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        const bookings = await prisma.booking.findMany({
            where: {
                user_id: user_id
            },
            orderBy: {
                booked_at: "desc"
            },
            include: {
                show: {
                    include: {
                        movie: {
                            select: {
                                title: true,
                                language: true,
                                genre: true,
                                poster_url: true
                            }
                        },
                        theater: {
                            select: {
                                theater_name: true,
                                city: true
                            }
                        },
                        screen: {
                            select: {
                                screen_name: true
                            }
                        }
                    }
                },
                bookingSeats: {
                    include: {
                        seat: {
                            select: {
                                seat_number: true,
                                seat_type: true
                            }
                        }
                    }
                },
                payments: {
                    select: {
                        payment_gateway: true,
                        payment_status: true,
                        transaction_id: true,
                        paid_at: true
                    }
                }
            }
        });

        const formattedBookings = bookings.map((booking) => ({
            booking_id: booking.id,

            movie: {
                title: booking.show.movie.title,
                language: booking.show.movie.language,
                genre: booking.show.movie.genre,
                poster_url: booking.show.movie.poster_url
            },

            theater: {
                theater_name: booking.show.theater.theater_name,
                city: booking.show.theater.city,
                screen_name: booking.show.screen.screen_name
            },

            show: {
                show_date: booking.show.show_date,
                start_time: booking.show.start_time,
                end_time: booking.show.end_time
            },

            seats: booking.bookingSeats.map((seat) => ({
                seat_number: seat.seat.seat_number,
                seat_type: seat.seat.seat_type,
                price: seat.price
            })),

            total_amount: booking.total_amount,
            booking_status: booking.booking_status,
            payment_status: booking.payment_status,

            payments: booking.payments,

            booked_at: booking.booked_at
        }));

        return res.status(200).json({
            message: "Booking history fetched successfully",
            totalBookings: formattedBookings.length,
            bookings: formattedBookings
        });

    } catch (error) {
        console.error("BOOKING HISTORY ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

exports.downloadTicket = async (req, res) => {
    try {
        const bookingId = Number(req.params.id);

        if (isNaN(bookingId)) {
            return res.status(400).json({
                message: "Invalid booking ID"
            });
        }

            const booking = await prisma.booking.findUnique({
                where: { id: bookingId },
                include: {
                    show: {
                        include: {
                            movie: true,
                            theater: true,
                            screen: true
                        }
                    },
                    bookingSeats: {
                        include: {
                            seat: true
                        }
                    },
                    user: true
                }
            });

            if (!booking) {
                return res.status(404).json({
                    message: "Booking not found"
                });
            }

            const qrPayload = {
                booking_id: booking.id,
                user_id: booking.user_id,
                show_id: booking.show_id
            };

            const token = jwt.sign(qrPayload, process.env.JWT_SECRET);
            const qrImage = await QRCode.toDataURL(token);
            const qrBuffer = Buffer.from(qrImage.split(",")[1], "base64");

            let posterBuffer = null;
            try {
                console.info("downloadTicket: poster_url ->", booking.show?.movie?.poster_url);
                posterBuffer = await fetchImageBuffer(booking.show.movie.poster_url);
                console.info("downloadTicket: posterBuffer ->", posterBuffer ? `${posterBuffer.length} bytes` : "null");
            } catch (posterError) {
                console.warn("Poster load failed:", posterError.message);
            }

            const doc = new PDFDocument({ size: "A4", margin: 40 });

            res.setHeader("Content-Type", "application/pdf");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename=ticket-${booking.id}.pdf`
            );

            doc.pipe(res);

            if (posterBuffer) {
                try {
                    doc.image(posterBuffer, {
                        fit: [520, 240],
                        align: "center",
                        valign: "center"
                    });
                    doc.moveDown();
                } catch (posterError) {
                    console.warn("Failed to render poster image:", posterError.message);
                }
            }

            // Styles
            const primaryColor = "#0f172a"; // slate-900
            const accentColor = "#0ea5a4"; // teal-400
            const muted = "#6b7280"; // gray-500

            // Header: movie title
            doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(26).text(booking.show.movie.title, { align: "center" });
            doc.moveDown(0.2);

            // Subheader: theater + screen
            doc.font("Helvetica").fontSize(10).fillColor(muted).text(`${booking.show.theater.theater_name} • ${booking.show.theater.city}, ${booking.show.theater.state}`, { align: "center" });
            doc.text(`Screen: ${booking.show.screen.screen_name}`, { align: "center" });
            doc.moveDown(0.8);

            // Divider
            doc.strokeColor("#e6eef0").lineWidth(1).moveTo(doc.page.margins.left, doc.y).lineTo(doc.page.width - doc.page.margins.right, doc.y).stroke();
            doc.moveDown(0.6);

            // Two-column layout: left = details, right = QR
            const contentWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
            const qrSize = 160;
            const gap = 20;
            const leftWidth = contentWidth - qrSize - gap;

            const colX = doc.x;
            const colY = doc.y;

            // Left column - details
            doc.save();
            doc.x = colX;
            doc.y = colY;

            doc.font("Helvetica-Bold").fontSize(14).fillColor(primaryColor).text("Ticket Details", { width: leftWidth });
            doc.moveDown(0.2);

            doc.fontSize(10).fillColor(muted);
            const label = (k) => { doc.font("Helvetica-Bold").fillColor(primaryColor).text(k, { continued: true, width: 80 }); doc.font("Helvetica").fillColor("#111827"); };

            label("Booking ID: "); doc.text(` ${booking.id}`);
            label("Name: "); doc.text(` ${booking.user.name}`);
            const showStart = booking.show.show_start_time ? new Date(booking.show.show_start_time) : null;
            const showTimeText = showStart ? `${showStart.toLocaleString()}` : 'N/A';
            label("Show Time: "); doc.text(` ${showTimeText}`);
            label("Seats: "); doc.text(` ${booking.bookingSeats.map(bs => bs.seat.seat_number).join(", ")}`);
            label("Total Paid: "); doc.text(`Rs.${booking.total_amount}`);

            doc.restore();

            // Right column - QR code
            const qrX = doc.page.width - doc.page.margins.right - qrSize;
            const qrY = colY;
            try {
                doc.image(qrBuffer, qrX, qrY, { fit: [qrSize, qrSize], align: "center" });
            } catch (e) {
                console.warn("Failed to render QR image:", e.message);
            }

            // QR caption
            const captionY = qrY + qrSize + 8;
            doc.font("Helvetica").fontSize(10).fillColor(muted).text("Scan this QR code at the entrance", qrX - 10, captionY, { width: qrSize + 20, align: "center" });

            // Footer note
            doc.moveTo(doc.page.margins.left, doc.page.height - doc.page.margins.bottom - 60);
            doc.fontSize(9).fillColor(muted).text("Valid only for the show listed above.", { align: "center" });

            doc.end();
        } catch (error) {
            console.error("PDF ERROR:", error);

            return res.status(500).json({
                message: "Server error",
                error: error.message
            });
        }
    };

exports.cancelBooking = async (req, res) => {
    try {
        const {
            booking_id,
            user_id,
            cancel_reason
        } = req.body;

        // 1. Basic Validation

        if (!booking_id || !user_id || !cancel_reason) {
            return res.status(400).json({
                message: "booking_id, user_id and cancel_reason are required"
            });
        }

        const bookingId = Number(booking_id);
        const userId = Number(user_id);

        if (isNaN(bookingId) || isNaN(userId)) {
            return res.status(400).json({
                message: "Invalid booking_id or user_id"
            });
        }

        // 2. Find Booking

        const booking = await prisma.booking.findUnique({
            where: {
                id: bookingId
            },
            include: {
                show: true
            }
        });

        if (!booking) {
            return res.status(404).json({
                message: "Booking not found"
            });
        }

        // 3. Validate Booking Ownership

        if (booking.user_id !== userId) {
            return res.status(403).json({
                message: "You are not allowed to cancel this booking"
            });
        }

        // 4. Prevent Duplicate Cancellation

        if (booking.booking_status === "CANCELLED") {
            return res.status(400).json({
                message: "Booking already cancelled"
            });
        }

        // 5. Validate Show Time

        // Combine show_date + start_time

        const showStartTime = new Date(booking.show.start_time);
        const now = new Date();

        if (showStartTime <= now) {
            return res.status(400).json({
                message: "Cannot cancel booking after show has started"
            });
        }

        // 6. Update Booking Status

        const updatedBooking = await prisma.booking.update({
            where: {
                id: bookingId
            },
            data: {
                booking_status: "CANCELLED",
                payment_status: "REFUND_PENDING"
            }
        });

        // 7. (Optional Future)
        // Create Refund Record

        // Example:
        // await prisma.refund.create({...})

        // 8. Success Response

        return res.status(200).json({
            message: "Booking cancelled successfully",
            cancel_reason,
            booking: updatedBooking
        });

    } catch (error) {
        console.error("CANCEL BOOKING ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};

exports.requestRefund = async (req, res) => {
    try {
        const bookingId = Number(req.params.id);
        const userId = req.user.id;

        // 1. Get Booking

        const booking = await prisma.booking.findUnique({
            where: { id: bookingId },
            include: {
                show: true
            }
        });

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // 2. Ownership Check

        if (booking.user_id !== userId) {
            return res.status(403).json({ message: "Unauthorized" });
        }

        // 3. Status Validation

        if (booking.booking_status !== BookingStatus.CANCELLED) {
            return res.status(400).json({
                message: "Only cancelled bookings can be refunded"
            });
        }

        if (booking.payment_status !== PaymentStatus.SUCCESS) {
            return res.status(400).json({
                message: "Payment not eligible for refund"
            });
        }

        // 4. Time Validation

        const showStartTime = new Date(booking.show.start_time);
        const now = new Date();

        // Example: block refund if show already started
        if (now >= showStartTime) {
            return res.status(400).json({
                message: "Cannot refund after show start time"
            });
        }

        // Optional: 30 min rule
        const diffMinutes = (showStartTime - now) / (1000 * 60);
        if (diffMinutes < 30) {
            return res.status(400).json({
                message: "Refund allowed only before 30 minutes of show"
            });
        }

        // 5. Transaction (Important)

        const result = await prisma.$transaction(async (tx) => {

            // Update Booking

            const updatedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: {
                    booking_status: BookingStatus.CANCELLED,
                    payment_status: PaymentStatus.REFUND_PENDING
                }
            });

            // Update Payment

            await tx.payment.updateMany({
                where: { booking_id: bookingId },
                data: {
                    payment_status: PaymentStatus.REFUND_PENDING
                }
            });

            return updatedBooking;
        });

        // 6. Response

        return res.status(200).json({
            message: "Refund request initiated",
            booking: result
        });

    } catch (error) {
        console.error("REFUND ERROR:", error);

        return res.status(500).json({
            message: "Server error",
            error: error.message
        });
    }
};