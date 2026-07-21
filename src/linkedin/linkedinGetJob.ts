import { type Page } from "puppeteer-core";
import { URL_JOB } from "./linkedInData.ts";

async function extractDescription(page: Page) {
  const selector =
    '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]';

  await page.waitForSelector(selector, {
    visible: true,
    timeout: 10000,
  });

  return page.$eval(selector, el => el.textContent?.trim() ?? null);
}

async function extractLink(page: Page, jobId: string) {
  const selector = 'a[href*="/jobs/view/"][href*="/apply/"], a[href*="/safety/go/"]';
  await page.waitForSelector(selector, { timeout: 10000 });

  const href = await page.$eval(
    selector,
    a => (a as HTMLAnchorElement).href
  );

  if (href.includes("/jobs/view/") && href.includes("/apply/")) {
    return `${URL_JOB}${jobId}/apply`;
  }

  const encoded = new URL(href).searchParams.get("url");
  if (!encoded) return null;

  const url = new URL(decodeURIComponent(encoded));
  return `${url.origin}${url.pathname}`;
}

async function extractCompanyName(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector('[aria-label^="Company,"]');
    if (!element) return null;
    const label = element.getAttribute("aria-label");
    return label?.match(/^Company,\s*(.+?)\.$/)?.[1] ?? null;
  });
}

async function extractData(page: Page, jobId: string) {
  const url = `${URL_JOB}${jobId}`;
  await page.goto(url, { waitUntil: "load", });

  const companyName = await extractCompanyName(page);
  const link = await extractLink(page, jobId);
  const description = await extractDescription(page);

  console.log(`------------------------ ${companyName} ------------------------`);
  console.log(jobId, "->", link);
  console.log(description);
  console.log("------------------------ End ------------------------ \n\n");
}

export async function getJobData(page: Page, jobIds: string[]) {
  for (const jobId of jobIds) {
    try {
      await extractData(page, jobId);
    } catch (err) {
      console.error(`Failed to extract job ${jobId}`, err);
    }
  }
}