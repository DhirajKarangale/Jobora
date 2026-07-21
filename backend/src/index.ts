import { edge, closeBrowser } from "./browserManager.ts";
import linkedin from "./linkedin/index.ts";

const browser = await edge();
await linkedin(browser);
// await closeBrowser(browser);