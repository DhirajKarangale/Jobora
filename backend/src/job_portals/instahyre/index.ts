import { type Browser, type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { extractJobData } from "./jobData.ts";
import { INSTAHYRE_URL_JOB_SEARCH, blacklistedCompanies } from "../../utils/constants.ts";

async function applyJobs(page: Page): Promise<number> {
  let jobsApplied = 0;

  while (true) {
    try {
      await page.waitForSelector('.apply button', { visible: true, timeout: 5000 });
      const applyBtn = await page.$('.apply button');

      if (!applyBtn) {
        console.log("No apply button found. Exiting loop.");
        break;
      }

      const { companyName } = await extractJobData(page);

      if (!companyName || !blacklistedCompanies.includes(companyName.toLowerCase())) {
        await page.evaluate((btn: any) => btn.click(), applyBtn);
        jobsApplied++;
      }
      await delay(2000);
    } catch (error) {
      break;
    }
  }

  return jobsApplied;
}

export default async function instahyer(browser: Browser) {
  const page = await browser.newPage();
  await page.goto(INSTAHYRE_URL_JOB_SEARCH, { waitUntil: "load" });

  let totalJobsApplied = 0;

  try {
    await delay(2000);

    try {
      await page.waitForSelector('button#interested-btn', { visible: true, timeout: 5000 });
      await page.click('button#interested-btn');
      await delay(2000);
    } catch (e) {
      console.log("No 'View »' button found on root page. Proceeding anyway.");
    }

    totalJobsApplied += await applyJobs(page);
  } catch (error) {
    console.error("Failed to apply on root page", error);
  }

  try {
    let isSearchDkVisible = false;
    try {
      await page.waitForSelector('li#search-dk', { visible: true, timeout: 1000 });
      isSearchDkVisible = true;
    } catch (e) {
      isSearchDkVisible = false;
    }

    if (!isSearchDkVisible) {
      const searchPanelHeading = await page.$('.job-search-heading');
      if (searchPanelHeading) {
        await searchPanelHeading.click();
        await delay(1000);
      }
    }

    await page.waitForSelector('li#search-dk', { visible: true, timeout: 5000 });
    await page.click('li#search-dk');
    await delay(2000);

    await page.waitForSelector('.employer-row #employer-profile-opportunity', { timeout: 10000 });
    await page.click('.employer-row #employer-profile-opportunity');
    await delay(2000);

    totalJobsApplied += await applyJobs(page);
  } catch (error) {
    console.log("No search results found, or search took too long.");
  }

  await page.close();
  return totalJobsApplied;
}
