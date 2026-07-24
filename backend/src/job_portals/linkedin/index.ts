import { type Browser } from "puppeteer-core";
import { getJobIds } from "./jobIds.ts";
import { getJobData } from "./jobData.ts";

export default async function linkedin(browser: Browser): Promise<void> {
  const jobIds = await getJobIds(browser);
  await getJobData(browser, jobIds);
}
