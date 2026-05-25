// src/controllers/bookingController.js
const { acquireSeatLock } = require('../services/seatLockService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function handleSeatSelection(req, res) {
    const { showId, userId, seatIds } = req.body; // e.g., seatIds: ["5", "6"]

    // 1. Instantly attempt to grab the lock in fast Redis memory
    const lockSuccessful = await acquireSeatLock(showId, userId, seatIds);

    if (!lockSuccessful) {
        return res.status(400).json({ 
            success: false, 
            message: "Too late! One or more of those seats were just snatched up by another customer." 
        });
    }

    // 2. The seats are safely locked for 10 minutes! Now add a placeholder record to your MySQL fallback tracking table
    await prisma.seatLock.createMany({
        data: seatIds.map(id => ({
            user_id: userId,
            show_id: showId,
            seat_id: parseInt(id),
            expires_at: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes from now
        }))
    });

    return res.status(200).json({ 
        success: true, 
        message: "Seats reserved! Go ahead and complete your payment." 
    });
}