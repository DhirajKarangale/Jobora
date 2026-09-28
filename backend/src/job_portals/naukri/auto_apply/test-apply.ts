import { edge } from "../../../utils/browserManager.ts";
import { handleNaukriApply } from "./index.ts";

async function run() {
  console.log("Starting browser connection...");
  const browser = await edge();
  const page = await browser.newPage();

  // Example job ID, replace with a real one that has a chatbot form
  const jobIds = [
    "job-listings-280926015371"
  ];

  for (const jobId of jobIds) {
    console.log(`Applying to Naukri job ${jobId}...`);
    try {
      const result = await handleNaukriApply(page, jobId);
      console.log(`Auto Apply Result for ${jobId}: ${result}`);
    } catch (error) {
      console.error(`Failed to process job ${jobId}:`, error);
    }
  }

  console.log("Done. Check the browser to see the result!");
}

run();
