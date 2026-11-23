import 'dotenv/config';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
  socket: {
    connectTimeout: 2_000,
    reconnectStrategy: false,
  },
});

redisClient.on('error', (error) => {
  console.error('Redis error:', error.message);
});

export async function connectRedis() {
  if (!process.env.REDIS_URL) {
    return null;
  }

  try {
    await redisClient.connect();
    console.log('Redis connected');
    return redisClient;
  } catch (error) {
    console.warn('Redis indisponible, continuation sans cache:', error.message);
    return null;
  }
}

export async function closeRedis() {
  if (redisClient.isOpen) {
    try {
      await redisClient.quit();
    } catch (error) {
      console.warn('Redis shutdown failed:', error.message);
    }
  }
}

export default redisClient;
