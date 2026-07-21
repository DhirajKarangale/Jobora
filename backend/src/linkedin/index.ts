import { type Browser } from "puppeteer-core";
import { getJobIds } from "./jobIds.ts";
import { getJobData } from "./jobData.ts";
import { LINKEDIN_URL_JOB_SEARCH } from "../data/data.ts";

export default async function linkedin(browser: Browser) {
  const page = await browser.newPage();
  await page.goto(LINKEDIN_URL_JOB_SEARCH, { waitUntil: "load", });
  const jobIds = await getJobIds(page);
  const savedJobs = await getJobData(browser, jobIds);
  console.log("jobIds: ", jobIds.length);
  console.log("Linkedin: ", savedJobs.length);
}