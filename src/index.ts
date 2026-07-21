import fs from "node:fs/promises";
import { edge, closeBrowser } from "./initBrowser.js";
import { setTimeout as delay } from "node:timers/promises";

const linkedinULR = "https://www.linkedin.com/jobs/search-results/?currentJobId=4442784137&keywords=software%20engineer&origin=JOB_SEARCH_PAGE_JOB_FILTER&referralSearchId=uW6cOvg%2FqGDP91uF52c9Ug%3D%3D&f_TPR=r86400";
// job url: https://www.linkedin.com/jobs/view/4442784137/

async function main() {
  const browser = await edge();
  
  const page = await browser.newPage();
  await page.goto(linkedinULR, { waitUntil: "load", });

  let pageNo = 1;
  let cnt = 5;

  await fs.writeFile("jobs.txt", "");
  
  while (cnt-- > 0) {
    const jobIds = await page.$$eval(
      'div[componentkey^="job-card-component-ref-"]',
      cards =>
        cards
          .map(card => card.getAttribute("componentkey")?.match(/\d+$/)?.[0])
          .filter(Boolean)
    );

    await fs.appendFile(
      "jobs.txt",
      `------------------------ ${pageNo} ------------------------\n` +
      jobIds.join("\n") +
      "\n\n"
    );

    console.log(`Page ${pageNo}: ${jobIds.length} jobs`);

    const nextButton = await page.$(
      '[data-testid="pagination-controls-next-button-visible"]'
    );

    if (!nextButton) break;

    const firstJob = jobIds[0];

    if (!firstJob) {
      break;
    }

    await nextButton.click();

    await page.waitForFunction(
      (id) => {
        const card = document.querySelector(
          'div[componentkey^="job-card-component-ref-"]'
        );
        return (
          card &&
          !card.getAttribute("componentkey")?.endsWith(id)
        );
      },
      {},
      firstJob
    );

    pageNo++;
  }
}

main().catch(console.error);