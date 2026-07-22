import { connectRedis } from "./redis/index.ts";
import { connectDb } from "./db/index.ts";
import { edge, closeBrowser } from "./utils/browserManager.ts";
import linkedin from "./linkedin/index.ts";

await connectDb();
await connectRedis();

const browser = await edge();
await linkedin(browser);
// await closeBrowser(browser);