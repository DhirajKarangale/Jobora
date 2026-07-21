import { type Page } from "puppeteer-core";
import { LINKEDIN_PAGES } from "../data/data.ts";
import { filterExistingJobIds } from "../db/checkJobIds.ts";

const JOB_SELECTOR = 'div[componentkey^="job-card-component-ref-"]';
const NEXT_BUTTON_SELECTOR = '[data-testid="pagination-controls-next-button-visible"]';

async function extractJobIds(page: Page): Promise<string[]> {
  const ids = await page.evaluate(selector => {
    return [...document.querySelectorAll(selector)]
      .map(el => el.getAttribute("componentkey"))
      .map(key => key?.replace("job-card-component-ref-", ""))
      .filter(Boolean);
  }, JOB_SELECTOR);
  return ids as string[];
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

export async function getJobIds(page: Page) {
  let pageCount = LINKEDIN_PAGES;
  const jobIds = new Set<string>();

  while (pageCount-- > 0) {
    const currentJobIds = await extractJobIds(page);
    if (currentJobIds.length === 0) break;

    currentJobIds.forEach(id => jobIds.add(id));

    const exists = await page.$(NEXT_BUTTON_SELECTOR);
    if (!exists) break;
    await page.click(NEXT_BUTTON_SELECTOR);

    const pageChanged = await waitForNextPage(page, currentJobIds);
    if (!pageChanged) break;
  }

  const uniqueJobIds = await filterExistingJobIds(jobIds);
  return uniqueJobIds;
}