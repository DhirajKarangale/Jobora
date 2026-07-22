import { Redis } from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const redisUrl = process.env.REDIS_URL;

export const redis = new Redis(redisUrl || "redis://127.0.0.1:6379", {
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on("error", (err: Error) => {
  console.error("Redis error:", err.message);
});

export async function connectRedis(): Promise<Redis> {
  try {
    if (redis.status !== "ready" && redis.status !== "connect") {
      await redis.connect();
      console.log("Connected to Redis successfully.");
    }
    return redis;
  } catch (error) {
    console.error("Failed to connect to Redis:", error);
    throw error;
  }
}
