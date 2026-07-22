import { connectRedis } from "./redis/index.ts";
import { edge, closeBrowser } from "./browserManager.ts";
import linkedin from "./linkedin/index.ts";

await connectRedis();

const browser = await edge();
await linkedin(browser);
// await closeBrowser(browser);