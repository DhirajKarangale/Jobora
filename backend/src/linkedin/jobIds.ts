import { type ElementHandle, type Page } from "puppeteer-core";
import { LINKEDIN_PAGES } from "../data/data.ts";
import { filterExistingJobIds } from "../db/checkJobIds.ts";

const JOB_SELECTOR = 'div[componentkey^="job-card-component-ref-"]';
const NEXT_BUTTON_SELECTOR = '[data-testid="pagination-controls-next-button-visible"]';

async function extractJobIds(page: Page): Promise<string[]> {
  // return page.$$eval(
  //   JOB_SELECTOR,
  //   cards =>
  //     cards
  //       .map(card => card.getAttribute("componentkey")?.match(/\d+$/)?.[0])
  //       .filter((id): id is string => id !== undefined)
  // );

  const ids = await page.evaluate(selector => {
    return [...document.querySelectorAll(selector)]
      .map(el => el.getAttribute("componentkey"))
      .map(key => key?.replace("job-card-component-ref-", ""))
      .filter(Boolean);
  }, JOB_SELECTOR);

  console.log(ids);
  return ids as string[];
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
  let pageCount = LINKEDIN_PAGES;
  const jobIds = new Set<string>();

  while (pageCount-- > 0) {
    const currentJobIds = await extractJobIds(page);
    // console.log("currentJobIds: ", currentJobIds);
    if (currentJobIds.length === 0) break;

    currentJobIds.forEach(id => jobIds.add(id));

    const nextButton = await getNextButton(page);
    if (!nextButton) break;

    await nextButton.click();

    const pageChanged = await waitForNextPage(page, currentJobIds);
    if (!pageChanged) break;
  }

  const uniqueJobIds = await filterExistingJobIds(jobIds);
  return uniqueJobIds;
}