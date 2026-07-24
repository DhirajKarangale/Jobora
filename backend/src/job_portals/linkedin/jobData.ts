import { type Page, Browser } from "puppeteer-core";
import { saveJob } from "../../cloud/db/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { addToProcessStream } from "../../cloud/redis/index.ts";
import { DataJob, LINKEDIN_URL_JOB, blacklistedCompanies, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsScraped } from "../../utils/automationState.ts";

const SELECTORS = {
  description: '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]',
  applyLink: 'a[href*="/jobs/view/"][href*="/apply/"], a[href*="/safety/go/"]',
  companyName: '[aria-label^="Company,"]',
  role: 'div[data-display-contents="true"] p',
};

async function extractDescription(page: Page) {
  const exists = await page.$(SELECTORS.description);

  if (!exists) {
    try {
      await page.waitForSelector(SELECTORS.description, {
        visible: true,
        timeout: 10000,
      });
    } catch {
      return null;
    }
  }

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

  const encodedUrl = new URL(href).searchParams.get("url");
  if (!encodedUrl) return null;

  return encodedUrl.trim();
}

async function extractCompanyName(page: Page) {
  return page.evaluate(selector => {
    const element = document.querySelector(selector);
    if (!element) return null;

    const label = element.getAttribute("aria-label")?.trim();
    return label?.match(/^Company,\s*(.+?)\.$/)?.[1]?.trim() ?? null;
  }, SELECTORS.companyName);
}

async function extractRole(page: Page) {
  return page.evaluate(() => {
    const h1 = document.querySelector('.job-details-jobs-unified-top-card__job-title h1, h1.t-24, h1');
    if (h1 && !h1.closest('header') && !h1.closest('#global-nav')) {
      const text = h1.textContent?.trim();
      if (text && text !== "Me") return text;
    }

    const elements = document.querySelectorAll('div[data-display-contents="true"] p');
    for (const element of elements) {
      if (element.closest('header') || element.closest('#global-nav') || element.closest('.global-nav')) {
        continue;
      }

      let text = '';
      for (const node of element.childNodes) {
        if (node.nodeType === Node.TEXT_NODE) {
          text += node.textContent;
        }
      }
      text = text.trim();

      if (text && text.length > 2) {
        return text;
      }
    }
    return null;
  });
}

async function extractData(browser: Browser, jobId: string) {
  const page = await browser.newPage();
  const applicationLink = `${LINKEDIN_URL_JOB}${jobId}`;
  await page.goto(applicationLink, { waitUntil: "load" });

  await delay(WAIT_TIME);
  const companyName = (await extractCompanyName(page))?.trim();
  const link = (await extractLink(page, jobId))?.trim();
  const description = (await extractDescription(page))?.trim();
  const role = (await extractRole(page))?.trim() || '';
  await delay(WAIT_TIME);
  await page.close();

  if (!companyName || !link || !description) return;
  if (blacklistedCompanies.some(company => companyName.toLowerCase().includes(company))) return;

  const data: DataJob = {
    id: null,
    sourceName: "LinkedIn",
    sourceJobId: jobId,
    companyName,
    jobId: null,
    description,
    link,
    portal_link: applicationLink,
    role
  };

  return await saveJob(data)
}

export async function getJobData(browser: Browser, jobIds: string[]) {
  for (const jobId of jobIds) {
    try {
      const id = await extractData(browser, jobId);
      if (id) {
        await addToProcessStream({ id });
        incrementJobsScraped();
      }
    } catch (err) {
    }
  }
}

