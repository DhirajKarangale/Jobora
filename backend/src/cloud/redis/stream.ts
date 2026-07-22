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

  console.log(`Send data to process redis stream: ${data.id || messageId}`);

  return messageId;
}

export async function fetchAndAckEligibleJobIds(): Promise<string[]> {
  const eligibleStreamKey = process.env.REDIS_CONSUMER_ELIGIBLE;
  if (!eligibleStreamKey) {
    throw new Error("Missing required environment variable: REDIS_CONSUMER_ELIGIBLE");
  }

  const eligibleGroup = `${eligibleStreamKey}_group`;

  try {
    await redis.xgroup("CREATE", eligibleStreamKey, eligibleGroup, "0", "MKSTREAM");
  } catch (err: any) {
    if (!err.message?.includes("BUSYGROUP")) {
      console.warn("Notice creating consumer group:", err.message);
    }
  }

  const jobIds: string[] = [];

  try {
    const rawEntries = await redis.xrange(eligibleStreamKey, "-", "+");

    if (!rawEntries || rawEntries.length === 0) {
      return [];
    }

    for (const entry of rawEntries) {
      const [msgId, fields] = entry;
      let extractedId: string | null = null;

      for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const val = fields[i + 1];
        if (key === "id" || key === "job_id") {
          extractedId = val;
          break;
        }
      }

      if (extractedId) {
        jobIds.push(extractedId);
      }
    }
  } catch (error) {
    console.error("Error processing eligible job stream:", error);
    throw error;
  }

  return Array.from(new Set(jobIds));
}

export async function deleteJobFromEligibleStream(targetIdInput: string | string[]): Promise<boolean> {
  const eligibleStreamKey = process.env.REDIS_CONSUMER_ELIGIBLE;
  if (!eligibleStreamKey) return false;

  const targetIds = new Set(Array.isArray(targetIdInput) ? targetIdInput : [targetIdInput]);
  if (targetIds.size === 0) return false;

  const eligibleGroup = `${eligibleStreamKey}_group`;

  try {
    const rawEntries = await redis.xrange(eligibleStreamKey, "-", "+");
    if (!rawEntries || rawEntries.length === 0) return false;

    let deletedAny = false;

    for (const entry of rawEntries) {
      const [msgId, fields] = entry;
      let extractedId: string | null = null;

      for (let i = 0; i < fields.length; i += 2) {
        const key = fields[i];
        const val = fields[i + 1];
        if (key === "id" || key === "job_id") {
          extractedId = val;
          break;
        }
      }

      if (extractedId && targetIds.has(extractedId)) {
        try {
          await redis.xack(eligibleStreamKey, eligibleGroup, msgId);
        } catch {
        }
        await redis.xdel(eligibleStreamKey, msgId);
        deletedAny = true;
        console.log(`Deleted job ${extractedId} (stream msg ${msgId}) from ${eligibleStreamKey}`);
      }
    }

    return deletedAny;
  } catch (error) {
    console.error(`Error deleting job ${targetIdInput} from Redis stream:`, error);
    return false;
  }
}

export async function addJobToEligibleStream(targetId: string): Promise<string> {
  const eligibleStreamKey = process.env.REDIS_CONSUMER_ELIGIBLE;
  if (!eligibleStreamKey || !targetId) {
    throw new Error("Missing REDIS_CONSUMER_ELIGIBLE environment variable or targetId");
  }

  const messageId = await redis.xadd(eligibleStreamKey, "*", "id", targetId);
  console.log(`Added job ${targetId} back to ${eligibleStreamKey} with msgId ${messageId}`);
  return messageId;
}
