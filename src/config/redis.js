// src/config/redis.js
const Redis = require('ioredis');

// Connect to Redis using the URL in your environment variables, or fallback to localhost
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379');

redis.on('connect', () => console.log('Connected to Redis successfully'));
redis.on('error', (err) => console.error('Redis Connection Error:', err));

module.exports = redis;