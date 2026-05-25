const express = require("express");
const router = express.Router();

const {
    verifyToken,
    isUser
} = require("../middlewares/auth.middleware");

const userController = require("../controllers/user.controller");

router.get(
    "/movie",
    verifyToken,
    userController.getMovies
);

router.get(
    "/movie/shows/:movieId",
    verifyToken,
    userController.getShowsByMovie
);

router.get(
    "/selected-show/:showId",
    verifyToken,
    userController.getShowDetails
)

router.get(
    "/shows/:showId/seats",
    verifyToken,
    userController.getSeatsByShow
);

router.post(
    "/bookings/lock-seats",
    verifyToken,
    isUser,
    userController.lockSeats
);

router.get(
    "/shows/:showId/lock-seats", 
    verifyToken,
    isUser,
    userController.getLockedSeats
);

router.post(
    "/bookings/unlock-seats",
    verifyToken,
    isUser,
    userController.unlockSeats
);

router.get(
    "/shows/:showId/booked-seats",
    verifyToken,
    isUser,
    userController.getBookedSeats
);

router.post(
    "/selected-seat-details",
    verifyToken,
    isUser,
    userController.getSelectedSeatDetails
);

router.post(
    "/bookings/confirm",
    verifyToken,
    isUser,
    userController.confirmBooking
);

router.post(
    "/bookings/payment",
    verifyToken,
    isUser,
    userController.createOrder
);

router.post(
    "/bookings/payment/verify",
    verifyToken,
    isUser,
    userController.verifyPayment
);

router.get(
    "/bookings/:id",
    verifyToken,
    isUser,
    userController.getBookingById
);

router.get(
    "/bookings/history/:userId",
    verifyToken,
    isUser,
    userController.getBookingHistory
);

router.post(
    "/bookings/cancel",
    verifyToken,
    isUser,
    userController.cancelBooking
);

router.get(
    "/booking/:id/ticket",
    verifyToken,
    isUser,
    userController.downloadTicket
);

router.post(
    "/booking/:id/refund",
    verifyToken,
    userController.requestRefund
);

module.exports = router;