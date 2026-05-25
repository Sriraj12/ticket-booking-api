const express = require('express');
const router = express.Router();

const { isAdmin, verifyToken } = require("../middlewares/auth.middleware.js");
const { createMovie, getAllMovies, getMovieById, toggleMovieStatus, updateMovie } = require("../controllers/adminMovie.controller.js");

router.post(
    "/create",
    verifyToken, 
    isAdmin,
    createMovie
);
router.get("/all",
    verifyToken,
    isAdmin,
    getAllMovies
);

router.get("/:movieId",
    verifyToken,
    isAdmin,
    getMovieById
);

router.put("/:movieId",
    verifyToken,
    isAdmin,
    updateMovie
);

router.patch("/:movieId",
    verifyToken,
    isAdmin,
    toggleMovieStatus
);

module.exports = router;