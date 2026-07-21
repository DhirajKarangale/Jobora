import { edge, closeBrowser } from "./browserManager.ts";
import { linkedin } from "./linkedin/linkedin.ts";


async function main() {
  const browser = await edge();
  await linkedin(browser);
  // await closeBrowser(browser);
}

main().catch(console.error);