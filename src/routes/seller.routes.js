const express = require("express");
const router = express.Router();

const {
    verifyToken,
    isSeller
} = require("../middlewares/auth.middleware");

const sellerController = require("../controllers/seller.controller");

router.post(
    "/theater",
    verifyToken,
    isSeller,
    sellerController.createTheater
);

router.post(
    "/screen",
    verifyToken,
    isSeller,
    sellerController.createScreen
);

router.post(
    "/show",
    verifyToken,
    isSeller,
    sellerController.createShow
);

router.post(
    "/movie",
    verifyToken,
    isSeller,
    sellerController.createMovie
);

router.post(
    "/seats/create",
    verifyToken,
    isSeller,
    sellerController.createSeats
);

router.get(
    "/shows/:showId/seats",
    sellerController.getAvailableSeats
);

router.get(
    "/dashboard",
    verifyToken,
    isSeller,
    sellerController.getSellerDashboard
);

router.get(
    "/all-movies",
    verifyToken,
    isSeller,
    sellerController.getAllMovies
)

router.put(
    "/movie/:id/status-update",
    verifyToken,
    isSeller,
    sellerController.updateTheMovieStatus
)

module.exports = router;