const express = require("express");
const router = express.Router();

const {
    verifyToken,
    isSeller
} = require("../middlewares/auth.middleware");

const seatController = require("../controllers/seat.controller");

router.post(
    "/generate/:screenId",
    verifyToken,
    isSeller,
    seatController.generateSeats
);

router.get(
    "/screen/:screenId",
    verifyToken,
    isSeller,
    seatController.getSeatsByScreen
);

module.exports = router;