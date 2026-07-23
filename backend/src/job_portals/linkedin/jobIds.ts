import { type Browser, Page } from "puppeteer-core";
import { LINKEDIN_PAGES, LINKEDIN_URL_JOB_SEARCH } from "../../utils/constants.ts";
import { filterExistingJobIds } from "../../cloud/db/index.ts";

const MAX_RETRIES = 3;
const JOB_SELECTOR = 'div[componentkey^="job-card-component-ref-"]';
const NEXT_BUTTON_SELECTOR = '[data-testid="pagination-controls-next-button-visible"]';

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractJobIds(page: Page): Promise<string[]> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      await page.waitForSelector(JOB_SELECTOR, { visible: true, timeout: 10000 });

      const ids = await page.evaluate(selector => {
        return [...document.querySelectorAll(selector)]
          .map(el => el.getAttribute("componentkey"))
          .map(key => key?.replace("job-card-component-ref-", ""))
          .filter(Boolean);
      }, JOB_SELECTOR);

      if (ids.length > 0) return ids as string[];
    } catch {
    }

    await page.reload({ waitUntil: "networkidle2" });
  }

  return [];
}

async function waitForNextPage(
  page: Page,
  previousJobIds: string[]
): Promise<boolean> {
  try {
    await page.waitForFunction(
      (selector, previousIds) => {
        const currentIds = [...document.querySelectorAll(selector)]
          .map(el => el.getAttribute("componentkey")?.match(/\d+$/)?.[0])
          .filter(Boolean);

        if (currentIds.length === 0) return false;

        if (currentIds.length !== previousIds.length) return true;

        return currentIds.some((id, i) => id !== previousIds[i]);
      },
      { timeout: 15000 },
      JOB_SELECTOR,
      previousJobIds
    );

    return true;
  } catch {
    return false;
  }
}

export async function getJobIds(browser: Browser) {
  const page = await browser.newPage();
  await page.goto(LINKEDIN_URL_JOB_SEARCH, { waitUntil: "load" });

  let pageCount = LINKEDIN_PAGES;
  const jobIds = new Set<string>();

  while (pageCount-- > 0) {
    await delay(1000);
    const currentJobIds = await extractJobIds(page);
    await delay(1000);

    if (currentJobIds.length === 0) break;
    currentJobIds.forEach(id => jobIds.add(id));

    const exists = await page.$(NEXT_BUTTON_SELECTOR);
    if (!exists) break;
    await page.click(NEXT_BUTTON_SELECTOR);

    const pageChanged = await waitForNextPage(page, currentJobIds);
    if (!pageChanged) break;
  }

  await page.close();
  const uniqueJobIds = await filterExistingJobIds(jobIds);
  return uniqueJobIds;
}
