const cron = require("node-cron");
const prisma = require("../config/prisma");

const startSeatLockCleanupJob = () => {

    // Runs every minute
    cron.schedule("* * * * *", async () => {

        try {

            const now = new Date();

            const deletedLocks = await prisma.seatLock.deleteMany({
                where: {
                    expires_at: {
                        lte: now,
                    },
                },
            });

            if (deletedLocks.count > 0) {
                console.log(
                    `Expired seat locks cleared: ${deletedLocks.count}`
                );
            }

        } catch (error) {
            console.error(
                "Seat lock cleanup cron failed:",
                error
            );
        }

    });

};

module.exports = startSeatLockCleanupJob;