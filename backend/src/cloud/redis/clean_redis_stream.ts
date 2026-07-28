import { redis, connectRedis } from "./config.ts";
import { pool } from "../db/index.ts";

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

export async function getConsumerGroupInfo(streamKey: string | undefined = GLOBAL_STREAM_KEY, groupName: string | undefined = GLOBAL_GROUP_NAME) {
    if (!streamKey || !groupName) {
        throw new Error("Missing streamKey or groupName");
    }

    try {
        await connectRedis();
        console.log(`\n--- Fetching info for consumer group: ${groupName} ---`);

        // Check pending items for the consumer group
        try {
            const pendingInfo = await redis.xpending(streamKey, groupName) as any[];
            const totalPending = pendingInfo[0];

            console.log(`Total pending items in group: ${totalPending}`);

            if (totalPending > 0) {
                const pendingMessages = await redis.xpending(streamKey, groupName, '-', '+', totalPending) as any[];

                console.log(`Pending Items Details:`);
                for (const msg of pendingMessages) {
                    const messageId = msg[0];
                    const itemData = await redis.xrange(streamKey, messageId, messageId) as any[];

                    if (itemData && itemData.length > 0) {
                        const fields = itemData[0][1];
                        let dbId = null;
                        let companyName = "Unknown";
                        for (let i = 0; i < fields.length; i += 2) {
                            if (fields[i] === 'id') {
                                dbId = fields[i + 1];
                                break;
                            }
                        }
                        
                        if (dbId) {
                            try {
                                const res = await pool.query(`SELECT company FROM jobs WHERE id = $1`, [dbId]);
                                if (res.rows.length > 0) {
                                    companyName = res.rows[0].company;
                                }
                            } catch (e) {
                                companyName = "Error fetching from DB";
                            }
                        }
                        
                        console.log(`- ID: ${messageId} | DB ID: ${dbId} | Company: ${companyName}`);
                    }
                }
            }
        } catch (err: any) {
            if (err.message && err.message.includes("NOGROUP")) {
                console.log(`Consumer group '${groupName}' does not exist yet. Skipping pending items check.`);
            } else {
                throw err;
            }
        }

        // Also fetch all items in the stream just to give a complete picture
        console.log(`\n--- Fetching info for entire stream: ${streamKey} ---`);
        const items = await redis.xrange(streamKey, '-', '+') as any[];

        console.log(`Total items in stream: ${items.length}`);
        for (const item of items) {
            const id = item[0];
            const fields = item[1];

            let dbId = null;
            let companyName = "Unknown";
            for (let i = 0; i < fields.length; i += 2) {
                if (fields[i] === 'id') {
                    dbId = fields[i + 1];
                    break;
                }
            }
            
            if (dbId) {
                try {
                    const res = await pool.query(`SELECT company FROM jobs WHERE id = $1`, [dbId]);
                    if (res.rows.length > 0) {
                        companyName = res.rows[0].company;
                    }
                } catch (e) {
                    companyName = "Error fetching from DB";
                }
            }
            
            console.log(`- ID: ${id} | DB ID: ${dbId} | Company: ${companyName}`);
        }

    } catch (error) {
        console.error(`Error fetching consumer group info:`, error);
    }
}

async function run() {
    // await clearEntireRedisStream();
    // await clearConsumerGroupData();
    // await flushRedisDatabase();
    await getConsumerGroupInfo();

    process.exit(0);
}
run();
