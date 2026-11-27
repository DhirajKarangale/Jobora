import { edge } from "../../../utils/browserManager.ts";
import { setTimeout as delay } from "node:timers/promises";
import { handleEasyApply } from "./index.ts";
import { WAIT_TIME } from "../../../utils/constants.ts";

async function run() {
  console.log("Starting browser connection...");
  const browser = await edge();
  const jobIds = [
    "4494630965",
    "4495260741",
    "4495289358"
  ];

  for (const jobId of jobIds) {
    console.log(`\nNavigating to job ${jobId}...`);
    const page = await browser.newPage();
    try {
      await page.evaluateOnNewDocument(() => {
        if (typeof (window as any).__name === "undefined") {
          (window as any).__name = (target: any) => target;
        }
      });

      await page.goto(`https://www.linkedin.com/jobs/view/${jobId}`, { waitUntil: "domcontentloaded", timeout: 45000 });
      await delay(WAIT_TIME);

      const result = await handleEasyApply(page, jobId);
      console.log(`Auto Apply Result for ${jobId}: ${result}`);
    } catch (error) {
      console.error(`Failed to process job ${jobId}:`, error);
    } finally {
      try {
        if (!page.isClosed()) await page.close();
      } catch { }
    }
  }

  console.log("\nDone. Check the browser to see the result!");
  // Disconnect from browser without closing it so you can inspect
  browser.disconnect();
}

run().catch(console.error);



/*
4458958166
4458935577
4449361836
4459819237
4457793082
4434310952
4449370691
4457763811
4460305735
4458009253
4458922901
4459845323
4458061181
4458959200
4458240267
4459853055
4459890437
4438487697

*/