import { redis } from "./config.ts";

const STREAM_KEY = process.env.REDIS_CONSUMER_PROCESS;

export async function addToProcessStream(data: Record<string, any>): Promise<string> {
  if (!STREAM_KEY) {
    throw new Error("REDIS_CONSUMER_PROCESS environment variable is not defined");
  }

  const fields: string[] = [];
  for (const [key, value] of Object.entries(data)) {
    fields.push(
      key,
      typeof value === "object" && value !== null
        ? JSON.stringify(value)
        : String(value ?? "")
    );
  }

  if (fields.length === 0) {
    throw new Error("Cannot add empty object to Redis stream");
  }

  const messageId = await redis.xadd(STREAM_KEY, "*", ...fields);
  if (!messageId) {
    throw new Error(`Failed to add message to stream: ${STREAM_KEY}`);
  }

  return messageId;
}
