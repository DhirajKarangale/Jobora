import { mxPageCount } from "./linkedInData.ts";
import { type Page } from 'puppeteer-core';

export async function getJobIds(page: Page) {
  let pageCount = mxPageCount;
  console.log("mxPageCount: ", mxPageCount);
  console.log("pageCount: ", pageCount);
  
  const uniqueJobIds = new Set<string>();

  while (pageCount-- > 0) {
    const jobIds = await page.$$eval(
      'div[componentkey^="job-card-component-ref-"]',
      cards => cards.map(card => card.getAttribute("componentkey")?.match(/\d+$/)?.[0]).filter((id): id is string => id !== undefined)
    );

    jobIds.forEach(id => uniqueJobIds.add(id));

    const nextButton = await page.$('[data-testid="pagination-controls-next-button-visible"]');
    if (!nextButton) break;

    const firstJob = jobIds[0];
    if (!firstJob) break;

    await nextButton.click();

    await page.waitForFunction(
      (id) => {
        const card = document.querySelector('div[componentkey^="job-card-component-ref-"]');
        return (card && !card.getAttribute("componentkey")?.endsWith(id));
      },
      {},
      firstJob
    );
  }

  console.log("Linkedin found: ", uniqueJobIds.size);
}