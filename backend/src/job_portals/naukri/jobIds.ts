import { type Browser, Page } from "puppeteer-core";
import { filterExistingJobIds } from "../../cloud/db/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { JOB_PORTAL_PAGINATATION, NAUKRI_URL_JOB_SEARCH, WAIT_TIME } from "../../utils/constants.ts";

const JOB_LINK_SELECTOR = 'a.title';

async function extractJobIds(page: Page): Promise<string[]> {
  try {
    await page.waitForSelector(JOB_LINK_SELECTOR, { visible: true, timeout: 10000 });
    const ids = await page.$$eval(JOB_LINK_SELECTOR, links => {
      return links
        .map(link => (link as HTMLAnchorElement).href)
        .filter(href => href && href.includes("/job-listings-"))
        .map(href => {
          try {
            const url = new URL(href);
            const path = url.pathname;
            const slug = path.replace("/job-listings-", "");
            const match = slug.match(/-([0-9a-zA-Z]+)$/);
            return match ? match[1] : slug;
          } catch {
            return "";
          }
        })
        .filter(id => id !== "");
    });
    return ids;
  } catch (error) {
    return [];
  }
}

export async function getJobIds(browser: Browser): Promise<string[]> {
  const page = await browser.newPage();
  await page.goto(NAUKRI_URL_JOB_SEARCH, { waitUntil: "load" });
  await delay(WAIT_TIME);

  let pageCount = JOB_PORTAL_PAGINATATION;
  const jobIds = new Set<string>();

  while (pageCount-- > 0) {
    const currentJobIds = await extractJobIds(page);
    await delay(WAIT_TIME);

    if (currentJobIds.length === 0) {
      break;
    }

    const initialSize = jobIds.size;
    currentJobIds.forEach(id => {
      if (id) jobIds.add(id.trim().toLowerCase());
    });

    if (jobIds.size === initialSize) {
      break;
    }

    try {
      const nextBtn = await page.evaluateHandle(() => {
        const spans = Array.from(document.querySelectorAll('a.styles_btn-secondary__2AsIP span'));
        return spans.find(span => span.textContent?.trim() === 'Next')?.parentElement;
      });

      if (nextBtn) {
        await (nextBtn as any).click();
        await delay(WAIT_TIME);
      } else {
        break;
      }
    } catch (err) {
      break;
    }
  }

  await delay(WAIT_TIME);
  await page.close();
  const uniqueJobIds = await filterExistingJobIds(jobIds);
  return uniqueJobIds;
}
