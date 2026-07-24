import { type Browser, Page } from "puppeteer-core";
import { filterExistingJobIds } from "../../cloud/db/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { JOB_PORTAL_PAGINATATION, WELLFOUND_URL_JOB_SEARCH } from "../../utils/constants.ts";

const JOB_LINK_SELECTOR = 'a.styles_jobLink__US40J';

async function extractJobIds(page: Page): Promise<string[]> {
  try {
    await page.waitForSelector(JOB_LINK_SELECTOR, { visible: true, timeout: 10000 });
    const ids = await page.$$eval(JOB_LINK_SELECTOR, links => {
      return links
        .map(link => link.getAttribute("href"))
        .filter(href => href && href.startsWith("/jobs/"))
        .map(href => href!.replace("/jobs/", ""));
    });
    return ids;
  } catch (error) {
    return [];
  }
}

export async function getJobIds(browser: Browser): Promise<string[]> {
  const page = await browser.newPage();
  await page.goto(WELLFOUND_URL_JOB_SEARCH, { waitUntil: "load" });
  await delay(2000);

  let pageCount = JOB_PORTAL_PAGINATATION;
  const jobIds = new Set<string>();

  while (pageCount-- > 0) {
    const currentJobIds = await extractJobIds(page);
    await delay(2000);

    if (currentJobIds.length === 0) {
      break;
    }

    const initialSize = jobIds.size;
    currentJobIds.forEach(id => jobIds.add(id));

    if (jobIds.size === initialSize) {
      break;
    }

    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    await delay(3000);
  }

  await delay(2000);
  await page.close();
  const uniqueJobIds = await filterExistingJobIds(jobIds);
  return uniqueJobIds;
}