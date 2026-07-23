import { redis } from "./config.ts";

export async function addToProcessStream(data: Record<string, any>): Promise<string> {
  const streamKey = process.env.REDIS_CONSUMER_PROCESS;
  if (!streamKey) {
    throw new Error("Missing required environment variable: REDIS_CONSUMER_PROCESS");
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

  const messageId = await redis.xadd(streamKey, "*", ...fields);
  if (!messageId) {
    throw new Error(`Failed to add message to stream: ${streamKey}`);
  }

  return messageId;
}
