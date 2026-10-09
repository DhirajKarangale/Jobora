import { type Page } from "puppeteer-core";
import { ResilientBrowser } from "../../utils/resilientBrowser.ts";
import { filterExistingJobIds } from "../../cloud/db/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { JOB_PORTAL_PAGINATATION, WELLFOUND_URL_JOB_SEARCH, WAIT_TIME } from "../../utils/constants.ts";

const JOB_LINK_SELECTOR = 'a[href^="/jobs/"]';

async function extractJobIds(page: Page): Promise<string[]> {
  try {
    await page.waitForSelector(JOB_LINK_SELECTOR, { visible: true, timeout: 10000 });
    const ids = await page.$$eval(JOB_LINK_SELECTOR, links => {
      return links
        .map(link => link.getAttribute("href"))
        .filter(href => href && href.startsWith("/jobs/"))
        .map(href => href!.replace("/jobs/", ""))
        .filter(id => id.match(/^\d+-/));
    });
    return ids;
  } catch (error) {
    console.error(`[Wellfound] Error extracting job IDs:`, error);
    return [];
  }
}

export async function getJobIds(resilientBrowser: ResilientBrowser): Promise<string[]> {
  const page = await resilientBrowser.newPage();
  await page.goto(WELLFOUND_URL_JOB_SEARCH, { waitUntil: "load" });
  await delay(WAIT_TIME);

  let pageCount = JOB_PORTAL_PAGINATATION;
  const jobIds = new Set<string>();
  let scrollCount = 0;

  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (pageCount-- > 0) {
    const currentJobIds = await extractJobIds(page);
    console.log(`[Wellfound] Scroll ${scrollCount}: Found ${currentJobIds.length} jobs. IDs: ${currentJobIds.join(', ')}`);
    await delay(WAIT_TIME);

    if (currentJobIds.length === 0) {
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        console.log(`[Wellfound] No jobs found on scroll ${scrollCount} after retries. Stopping pagination.`);
        break;
      }
    }

    const initialSize = jobIds.size;
    currentJobIds.forEach(id => {
      if (id) jobIds.add(id.trim().toLowerCase());
    });

    if (jobIds.size === initialSize && currentJobIds.length > 0) {
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        console.log(`[Wellfound] No new unique jobs found on scroll ${scrollCount} after retries. Stopping pagination.`);
        break;
      }
      console.log(`[Wellfound] No new jobs this scroll, retrying... (${retryCount}/${MAX_RETRIES})`);
    } else if (currentJobIds.length > 0) {
      retryCount = 0; // reset on success
    }

    console.log(`[Wellfound] Scrolling down for more jobs... Total unique so far: ${jobIds.size}`);
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    scrollCount++;
    await delay(WAIT_TIME);
  }

  await delay(WAIT_TIME);
  await page.close();
  
  console.log(`[Wellfound] Finished collecting job IDs. Total unique found before DB filter: ${jobIds.size}`);
  const uniqueJobIds = await filterExistingJobIds(jobIds);
  console.log(`[Wellfound] Total unique job IDs to process after DB filter: ${uniqueJobIds.length}`);
  return uniqueJobIds;
}