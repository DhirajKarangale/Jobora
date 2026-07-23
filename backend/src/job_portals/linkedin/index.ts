import { type Browser } from "puppeteer-core";
import { getJobIds } from "./jobIds.ts";
import { getJobData } from "./jobData.ts";

export default async function linkedin(browser: Browser) {
  const jobIds = await getJobIds(browser);
  const savedJobs = await getJobData(browser, jobIds);
}
