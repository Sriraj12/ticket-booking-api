// src/services/seatLockService.js
const redis = require('../config/redis');

// This script checks if seats are free ("A"). If yes, locks them. If not, drops out safely.
const lockLuaScript = `
    local showKey = KEYS[1]
    local lockStatus = ARGV[1]
    
    -- Loop through all seats passed in arguments to see if they are open
    for i = 2, #ARGV do
        local currentStatus = redis.call('HGET', showKey, ARGV[i])
        if currentStatus and currentStatus ~= "A" then
            return 0 -- Failed: At least one seat is already locked or booked
        end
    end
    
    -- If we get here, all seats are free. Let's reserve them!
    for i = 2, #ARGV do
        redis.call('HSET', showKey, ARGV[i], lockStatus)
    end
    return 1 -- Success!
`;

/**
 * Try to lock multiple seats instantly
 * @param {number} showId 
 * @param {number} userId 
 * @param {string[]} seatIds - e.g., ["12", "13"] (Your physical Seat ID keys)
 */
async function acquireSeatLock(showId, userId, seatIds) {
    const showKey = `show:seatmap:${showId}`;
    const lockValue = `LOCKED:user_${userId}`;

    // Execute the Lua script inside Redis
    // 1 = Number of keys passed, followed by the key, followed by our value parameters
    const result = await redis.eval(lockLuaScript, 1, showKey, lockValue, ...seatIds);

    if (result === 1) {
        // Automatically create a backup expiration key that lasts 10 minutes (600 seconds)
        // If the user fails to pay, this key expires, letting your system know to clear the seat map
        await redis.set(`cleanup:lock:show:${showId}:user:${userId}`, JSON.stringify(seatIds), 'EX', 600);
        return true;
    }
    
    return false;
}

module.exports = { acquireSeatLock };