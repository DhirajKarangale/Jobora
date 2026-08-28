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
});

export async function connectRedis(): Promise<Redis> {
  try {
    if (redis.status === "wait") await redis.connect();
    return redis;
  } catch (error) {
    throw error;
  }
}
