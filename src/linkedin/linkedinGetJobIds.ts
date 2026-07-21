import { type ElementHandle, type Page } from "puppeteer-core";
import { mxPageCount } from "./linkedInData.ts";
import { filterExistingJobIds } from "../db/checkJobIds.ts";

const JOB_SELECTOR = 'div[componentkey^="job-card-component-ref-"]';
const NEXT_BUTTON_SELECTOR = '[data-testid="pagination-controls-next-button-visible"]';

async function extractJobIds(page: Page): Promise<string[]> {
  return page.$$eval(
    JOB_SELECTOR,
    cards =>
      cards
        .map(card => card.getAttribute("componentkey")?.match(/\d+$/)?.[0])
        .filter((id): id is string => id !== undefined)
  );
}

async function getNextButton(page: Page): Promise<ElementHandle<Element> | null> {
  return page.$(NEXT_BUTTON_SELECTOR);
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
  let pageCount = mxPageCount;
  const jobIds = new Set<string>();

  while (pageCount-- > 0) {
    const currentJobIds = await extractJobIds(page);
    if (currentJobIds.length === 0) break;

    currentJobIds.forEach(id => jobIds.add(id));

    const nextButton = await getNextButton(page);
    if (!nextButton) break;

    await nextButton.click();

    const pageChanged = await waitForNextPage(page, currentJobIds);
    if (!pageChanged) break;
  }

  const uniqueJobIds = await filterExistingJobIds(jobIds);
  console.log("LinkedIn:", uniqueJobIds.length);

  return uniqueJobIds;
}