const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const http = require("http");
const { Server } = require("socket.io");
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
const commonRoutes = require("./routes/common.routes");
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
app.use("/api/common", commonRoutes);
app.use(errorLogger);
startSeatLockCleanupJob();

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.set("io", io);

io.on("connection", (socket) => {

    console.log("Socket connected:", socket.id);

    socket.on("join-show", (showId) => {

        socket.join(`show-${showId}`);

        console.log(
            `Socket ${socket.id} joined show-${showId}`
        );
    });

    socket.on("disconnect", () => {
        console.log("Socket disconnected:", socket.id);
    });
});

app.get("/", (req, res) => {
  res.send("Movie Booking API Running");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// module.exports = app;