const express = require("express");
const router = express.Router();

const {
    verifyToken,
    isSeller
} = require("../middlewares/auth.middleware");

const showController = require("../controllers/show.controller");

router.post(
    "/create",
    verifyToken,
    isSeller,
    showController.createShow
);

router.get(
    "/theater/:theaterId",
    verifyToken,
    isSeller,
    showController.getSellerShows
); 

router.delete(
    "/:showId",
    verifyToken,
    isSeller,
    showController.deleteShow
);

module.exports = router;