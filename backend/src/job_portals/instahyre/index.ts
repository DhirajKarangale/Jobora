import { type Browser, type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { extractJobData } from "./jobData.ts";
import { INSTAHYRE_URL_JOB_SEARCH, blacklistedCompanies, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsAutoApplied } from "../../utils/automationState.ts";

async function applyJobs(page: Page): Promise<void> {
  while (true) {
    try {
      await page.waitForSelector('.apply button', { visible: true, timeout: 5000 });
      const applyBtn = await page.$('.apply button');

      if (!applyBtn) {
        // console.log("No apply button found. Exiting loop.");
        break;
      }

      const { companyName } = await extractJobData(page);

      if (!companyName || !blacklistedCompanies.some(company => companyName.toLowerCase().includes(company))) {
        await page.evaluate((btn: any) => btn.click(), applyBtn);
        incrementJobsAutoApplied();
      }
      await delay(WAIT_TIME);
    } catch (error) {
      break;
    }
  }
}

export default async function instahyer(browser: Browser): Promise<void> {
  const page = await browser.newPage();

  try {
    await page.goto(INSTAHYRE_URL_JOB_SEARCH, { waitUntil: "load" });

    try {
      await delay(WAIT_TIME);

      try {
        await page.waitForSelector('button#interested-btn', { visible: true, timeout: 5000 });
        await page.click('button#interested-btn');
        await delay(WAIT_TIME);
      } catch (e) {
        // console.log("No 'View »' button found on root page. Proceeding anyway.");
      }

      await applyJobs(page);
    } catch (error) {
      // console.error("Failed to apply on root page", error);
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
          await delay(WAIT_TIME);
        }
      }

      await page.waitForSelector('li#search-dk', { visible: true, timeout: 5000 });
      await page.click('li#search-dk');
      await delay(WAIT_TIME);

      await page.waitForSelector('.employer-row #employer-profile-opportunity', { timeout: 10000 });
      await page.click('.employer-row #employer-profile-opportunity');
      await delay(WAIT_TIME);

      await applyJobs(page);
    } catch (error) {
      // console.log("No search results found, or search took too long.");
    }
  } finally {
    await page.close();
  }
}
