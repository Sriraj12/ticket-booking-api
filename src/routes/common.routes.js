const express = require("express");
const router = express.Router();

const commonController = require("../controllers/common.controller");

router.get("/all-movies", commonController.getMovieList);
router.get("/all-theaters/:city", commonController.getTheaterList);
router.get("/movie/:movieName", commonController.getMovieDetails);
router.get("/shows/:theaterName/:movieName", commonController.getShowtimes);

module.exports = router;
