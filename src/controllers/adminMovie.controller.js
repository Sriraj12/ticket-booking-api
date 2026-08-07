const { PrismaClient } = require("@prisma/client");
const prisma = require("../config/prisma");

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
    } = req.body;

    const movie = await prisma.movie.create({
      data: {
        title,
        language,
        duration,
        genre,
        release_date: new Date(release_date),
        poster_url,
        trailer_url,
      },
    });

    return res.status(201).json({
      success: true,
      movie,
    });

  } catch (error) {

    console.log(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create movie",
    });
  }
};

exports.getAllMovies = async (req, res) => {
  try {

    const movies = await prisma.movie.findMany({
      orderBy: {
        created_at: "desc",
      },
    });

    return res.json({
      success: true,
      movies,
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to fetch movies",
    });
  }
};

exports.getMovieById = async (req, res) => {
  try {

    const { id } = req.params;

    const movie = await prisma.movie.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!movie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    return res.json({
      success: true,
      movie,
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to fetch movie",
    });
  }
};

exports.updateMovie = async (req, res) => {
  try {

    const { id } = req.params;

    const {
      title,
      language,
      duration,
      genre,
      release_date,
      poster_url,
      trailer_url,
    } = req.body;

    const movie = await prisma.movie.update({
      where: {
        id: Number(id),
      },

      data: {
        title,
        language,
        duration,
        genre,
        release_date: new Date(release_date),
        poster_url,
        trailer_url,
      },
    });

    return res.json({
      success: true,
      movie,
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to update movie",
    });
  }
};

exports.toggleMovieStatus = async (req, res) => {
  try {

    const { id } = req.params;

    const existingMovie = await prisma.movie.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!existingMovie) {
      return res.status(404).json({
        success: false,
        message: "Movie not found",
      });
    }

    const movie = await prisma.movie.update({
      where: {
        id: Number(id),
      },

      data: {
        is_active: !existingMovie.is_active,
      },
    });

    return res.json({
      success: true,
      movie,
    });

  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Failed to update movie status",
    });
  }
};