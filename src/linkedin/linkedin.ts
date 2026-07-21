import { type Browser } from "puppeteer-core";
import { getJobIds } from "./linkedinGetJobIds.ts";
import { getJobData } from "./linkedinGetJob.ts";
import { URL_JOB_SEARCH } from "./linkedInData.ts";

export async function linkedin(browser: Browser) {
  const page = await browser.newPage();
  await page.goto(URL_JOB_SEARCH, { waitUntil: "load", });
  const jobIds = await getJobIds(page);
  // console.log("Linkedin: ", jobIds.length);
  await getJobData(page, jobIds);
}