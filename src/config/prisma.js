const { PrismaClient } = require("@prisma/client");
const { logger } = require("../utils/logger");

const prisma = new PrismaClient({
    log: [
        { emit: "event", level: "query" },
        { emit: "event", level: "error" },
        { emit: "event", level: "warn" },
    ],
});

prisma.$on("query", (e) => {
    logger.info("Prisma Query", {
        query: e.query,
        duration: e.duration,
    });
});

prisma.$on("error", (e) => {
    logger.error("Prisma Error", {
        message: e.message,
    });
});

module.exports = prisma;
