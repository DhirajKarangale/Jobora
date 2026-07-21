import { type Browser } from "puppeteer-core";
import { getJobIds } from "./JobIds.ts";
import { getJobData } from "./JobData.ts";
import { LINKEDIN_URL_JOB_SEARCH } from "../data/data.ts";

export default async function linkedin(browser: Browser) {
  const page = await browser.newPage();
  await page.goto(LINKEDIN_URL_JOB_SEARCH, { waitUntil: "load", });
  const jobIds = await getJobIds(page);
  console.log("jobIds: ", jobIds.length);
  const savedJobs = await getJobData(page, jobIds);
  console.log("Linkedin: ", savedJobs.length);
}