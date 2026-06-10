const { PrismaClient } = require("@prisma/client");
const prisma = require("../config/prisma");

exports.getMovieList = async (req, res) => {

    try {

        const { language } = req.query;

        const movies = await prisma.movie.findMany({
            select: {
                id: true,
                title: true,
            },
        });

        res.json({
            success: true,
            movies,
        });

    } catch (error) {
        console.error("Get movie list failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve movies",
            context: error
        });
    }

};

exports.getMovieDetails = async (req, res) => {

    const { movieName } = req.params;

    console.log("Fetching details for movie:", movieName);

    try {

        const movie = await prisma.movie.findFirst({
            where: { title: movieName },
            select: {
                title: true,
                duration: true,
                language: true,
                genre: true,
            },
        });

        if (!movie) {
            return res.status(404).json({
                success: false,
                message: "Movie not found",
            });
        }

        res.json({
            success: true,
            movie,
        });

    } catch (error) {
        console.error("Get movie details failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve movie details",
            context: error
        });
    }

}

exports.getTheaterList = async (req, res) => {

    try {

        const { city } = req.params;

        const theaters = await prisma.theater.findFirst({
            where: {
                city: city,
            },
            select: {
                theater_name: true,
                city: true,
            },
        });

        res.json({
            success: true,
            theaters,
        });

    } catch (error) {
        console.error("Get theater list failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve theaters",
            context: error
        });
    }

}

exports.getShowtimes = async (req, res) => {

    try {

        const { theaterName, movieName } = req.params;

        const theater = await prisma.theater.findFirst({
            where: {
                theater_name: theaterName,
            },
        });

        if (!theater) {
            return res.status(404).json({
                success: false,
                message: "Theater not found",
            });
        }

        const movie = await prisma.movie.findFirst({
            where: {
                title: movieName,
            },
        });

        if (!movie) {
            return res.status(404).json({
                success: false,
                message: "Movie not found",
            });
        }

        const shows = await prisma.show.findMany({
            where: {
                theater: {
                    theater_name: theaterName,
                },
                movie: {
                    title: movieName,
                },
            },
            select: {
                showtime: true,
            },
        });

        res.json({
            success: true,
            shows,
        });

    } catch (error) {
        console.error("Get showtimes failed:", error);
        res.status(500).json({
            success: false,
            message: "Failed to retrieve showtimes",
            context: error
        });
    }

}
