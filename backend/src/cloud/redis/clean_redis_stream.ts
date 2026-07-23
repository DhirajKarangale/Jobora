import { redis, connectRedis } from "./config.ts";

const GLOBAL_STREAM_KEY = process.env.REDIS_CONSUMER_PROCESS;
const GLOBAL_GROUP_NAME = process.env.REDIS_CONSUMER_PROCESS;

export async function clearEntireRedisStream(streamKey: string | undefined = GLOBAL_STREAM_KEY) {
    if (!streamKey) throw new Error("No stream key provided and REDIS_CONSUMER_PROCESS not set");

    try {
        await connectRedis();
        console.log(`Checking stream: ${streamKey}`);

        try {
            const groups = await redis.xinfo("GROUPS", streamKey) as any[];
            if (groups && groups.length > 0) {
                console.log(`Found ${groups.length} consumer groups.`);

                for (const group of groups) {
                    let groupName = '';
                    for (let i = 0; i < group.length; i += 2) {
                        if (group[i] === 'name') groupName = group[i + 1];
                    }

                    if (groupName) {
                        console.log(`\nGroup: ${groupName}`);
                        try {
                            const consumers = await redis.xinfo("CONSUMERS", streamKey, groupName) as any[];
                            console.log(`Consumers for group ${groupName}:`, consumers);
                        } catch (e) {
                            console.error(`Could not fetch consumers for group ${groupName}:`, (e as Error).message);
                        }
                    }
                }
            } else {
                console.log(`No consumer groups found for stream ${streamKey}.`);
            }
        } catch (e) {
            console.log(`Stream ${streamKey} might not exist or has no groups: ${(e as Error).message}`);
        }

        await redis.del(streamKey);
        console.log(`\nSuccessfully deleted stream '${streamKey}' and all its data/consumers.`);
    } catch (error) {
        console.error(`Error clearing entire redis stream ${streamKey}:`, error);
    }
}

export async function clearConsumerGroupData(streamKey: string | undefined = GLOBAL_STREAM_KEY, groupName: string | undefined = GLOBAL_GROUP_NAME) {
    if (!streamKey || !groupName) {
        throw new Error("Missing streamKey or groupName and REDIS_CONSUMER_PROCESS env variable");
    }

    try {
        await connectRedis();
        console.log(`Checking consumer group: ${groupName} in stream: ${streamKey}`);

        try {
            const pendingInfo = await redis.xpending(streamKey, groupName) as any[];
            const totalPending = pendingInfo[0];
            console.log(`Total pending entries for group ${groupName}: ${totalPending}`);

            if (totalPending > 0) {
                let remaining = totalPending;
                let clearedCount = 0;

                while (remaining > 0) {
                    const count = Math.min(remaining, 1000);
                    const pendingMessages = await redis.xpending(streamKey, groupName, '-', '+', count) as any[];

                    if (pendingMessages.length === 0) break;

                    const messageIds = pendingMessages.map((msg: any) => msg[0]);

                    await redis.xack(streamKey, groupName, ...messageIds);

                    await redis.xdel(streamKey, ...messageIds);

                    clearedCount += messageIds.length;
                    remaining -= messageIds.length;
                }

                console.log(`Successfully acknowledged and deleted ${clearedCount} pending entries from group ${groupName}.`);
            } else {
                console.log(`No pending data to delete for group ${groupName}.`);
            }

            await redis.xgroup("SETID", streamKey, groupName, "$");
            console.log(`Set consumer group ${groupName} to the latest offset ($). All unread data is skipped/cleared for this group.`);

        } catch (e) {
            console.error(`Could not clear data for group ${groupName}: ${(e as Error).message}`);
        }
    } catch (error) {
        console.error(`Error in clearConsumerGroupData:`, error);
    }
}

export async function flushRedisDatabase() {
    try {
        await connectRedis();
        console.log("Formatting/Resetting entire Redis database...");
        await redis.flushdb();
        console.log("Successfully wiped all data from the Redis database.");
    } catch (error) {
        console.error("Error flushing Redis database:", error);
    }
}

async function run() {
    // await clearEntireRedisStream();
    // await clearConsumerGroupData();
    await flushRedisDatabase();
    process.exit(0);
}
run();
