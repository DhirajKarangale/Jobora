import { type Browser } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { extractJobData } from "./jobData.ts";
import { INSTAHYRE_URL_JOB_SEARCH, blacklistedCompanies } from "../../utils/constants.ts";

export default async function instahyer(browser: Browser) {
  const page = await browser.newPage();
  await page.goto(INSTAHYRE_URL_JOB_SEARCH, { waitUntil: "load" });

  try {
    await delay(2000);

    const searchPanelHeading = await page.$('.job-search-heading');
    if (searchPanelHeading) {
      await searchPanelHeading.click();
      await delay(1000);
    }

    await page.waitForSelector('li#search-dk', { timeout: 5000 });
    await page.click('li#search-dk');
    await delay(2000);

    await page.waitForSelector('.employer-row #employer-profile-opportunity', { timeout: 5000 });
    await page.click('.employer-row #employer-profile-opportunity');
    await delay(2000);
  } catch (error) {
    await page.close();
    return 0;
  }

  let jobsApplied = 0;

  while (true) {
    try {
      await page.waitForSelector('.apply button', { visible: true, timeout: 5000 });
      const applyBtn = await page.$('.apply button');

      if (!applyBtn) {
        console.log("No apply button found. Exiting loop.");
        break;
      }

      // console.log("Applying instahyer job...");

      const { companyName } = await extractJobData(page);

      if (!companyName || !blacklistedCompanies.includes(companyName.toLowerCase())) {
        await page.evaluate((btn: any) => btn.click(), applyBtn);
        jobsApplied++;
      }
      await delay(2000);
    } catch (error) {
      // console.log("No more jobs to apply on instahyer");
      break;
    }
  }

  await page.close();
  return jobsApplied;
}
