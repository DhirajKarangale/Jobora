import { type Browser } from "puppeteer-core";
import { getJobIds } from "./linkedinGetJobIds.ts";
import { linkedinULRJobs } from "./linkedInData.ts";

export async function linkedin(browser: Browser) {
  const page = await browser.newPage();
  await page.goto(linkedinULRJobs, { waitUntil: "load", });
  await getJobIds(page);

  
}