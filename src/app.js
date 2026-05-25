const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
require("dotenv").config();

const requestLogger = require("./middlewares/requestLogger");
const errorLogger = require("./middlewares/errorHandler");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const sellerRoutes = require("./routes/seller.routes");
const userRoutes = require("./routes/user.routes");
const theaterRoutes = require("./routes/theater.routes");
const screenRoutes = require("./routes/screen.routes");
const seatRoutes = require("./routes/seat.routes");
const showRoutes = require("./routes/show.routes");
const adminMovieRoutes = require("./routes/adminMovie.routes");
const requestIdMiddleware = require("./middlewares/requestId");
const startSeatLockCleanupJob = require("./cron/seatLockCleanup.cron");


const app = express();

app.use(express.json());
app.use(cors());
app.use(helmet());
app.use(morgan("dev"));
app.use(requestIdMiddleware);
app.use(requestLogger);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/seller", sellerRoutes);
app.use("/api/user", userRoutes);
app.use("/api/theater", theaterRoutes);
app.use("/api/screen", screenRoutes);
app.use("/api/seat", seatRoutes);
app.use("/api/show", showRoutes);
app.use("/api/admin/movie", adminMovieRoutes);

app.use(errorLogger);
startSeatLockCleanupJob();


app.get("/", (req, res) => {
  res.send("Movie Booking API Running");
});

module.exports = app;