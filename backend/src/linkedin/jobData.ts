import { type Page } from "puppeteer-core";
import { DataJob } from "../data/data.ts";
import { saveJob } from "../db/addData.ts";
import { LINKEDIN_URL_JOB } from "../data/data.ts";

const SELECTORS = {
  description: '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]',
  applyLink: 'a[href*="/jobs/view/"][href*="/apply/"], a[href*="/safety/go/"]',
  companyName: '[aria-label^="Company,"]',
};

async function extractDescription(page: Page) {
  await page.waitForSelector(SELECTORS.description, {
    visible: true,
    timeout: 10000,
  });

  return page.$eval(
    SELECTORS.description,
    el => el.textContent?.trim() ?? null
  );
}

async function extractLink(page: Page, jobId: string) {
  const element = await page.$(SELECTORS.applyLink);

  if (!element) return null;

  const href = await element.evaluate(
    el => (el as HTMLAnchorElement).href.trim()
  );

  if (href.includes("/jobs/view/") && href.includes("/apply/")) {
    return `${LINKEDIN_URL_JOB}${jobId}/apply`;
  }

  const encoded = new URL(href).searchParams.get("url");
  if (!encoded) return null;

  const url = new URL(decodeURIComponent(encoded));
  return `${url.origin}${url.pathname}`.trim();
}

async function extractCompanyName(page: Page) {
  return page.evaluate(selector => {
    const element = document.querySelector(selector);
    if (!element) return null;

    const label = element.getAttribute("aria-label")?.trim();
    return label?.match(/^Company,\s*(.+?)\.$/)?.[1]?.trim() ?? null;
  }, SELECTORS.companyName);
}

async function extractData(page: Page, jobId: string) {
  await page.goto(`${LINKEDIN_URL_JOB}${jobId}`, {
    waitUntil: "load",
  });

  const companyName = (await extractCompanyName(page))?.trim();
  const link = (await extractLink(page, jobId))?.trim();
  const description = (await extractDescription(page))?.trim();

  if (!companyName || !link || !description) return;

  const data: DataJob = {
    id: null,
    sourceName: "LinkedIn",
    sourceJobId: jobId,
    companyName,
    jobId: null,
    description,
    link,
  };

  return await saveJob(data);
}

export async function getJobData(page: Page, jobIds: string[]) {
  const savedJobs = [];

  for (const jobId of jobIds) {
    try {
      const id = await extractData(page, jobId);
      savedJobs.push(id);
    } catch (err) {
      console.error(`Failed to extract job ${jobId}`, err);
    }
  }

  return savedJobs;
}