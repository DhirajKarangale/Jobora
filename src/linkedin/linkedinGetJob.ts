import { type Page } from "puppeteer-core";
import { URL_JOB } from "./linkedInData.ts";
import { DataJob } from "../data/data.ts";
import { saveJob } from "../db/addData.ts";

const SELECTORS = {
  description:
    '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]',

  applyLink:
    'a[href*="/jobs/view/"][href*="/apply/"], a[href*="/safety/go/"]',

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
  await page.waitForSelector(SELECTORS.applyLink, {
    timeout: 10000,
  });

  const href = await page.$eval(
    SELECTORS.applyLink,
    el => (el as HTMLAnchorElement).href.trim()
  );

  if (href.includes("/jobs/view/") && href.includes("/apply/")) {
    return `${URL_JOB}${jobId}/apply`;
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
  await page.goto(`${URL_JOB}${jobId}`, {
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

  await saveJob(data);
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