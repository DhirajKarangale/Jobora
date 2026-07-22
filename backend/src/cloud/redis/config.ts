import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

if (!process.env.REDIS_URL) {
  throw new Error("Missing required environment variable: REDIS_URL");
}

export const redis = new Redis(process.env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on("error", (err: Error) => {
  console.error("Redis connection error:", err.message);
});

export async function connectRedis(): Promise<Redis> {
  try {
    if (redis.status !== "ready" && redis.status !== "connect") {
      await redis.connect();
    }
    return redis;
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    throw error;
  }
}
