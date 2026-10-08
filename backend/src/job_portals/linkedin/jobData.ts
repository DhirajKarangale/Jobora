import { type Page, Browser } from "puppeteer-core";
import { saveJob, isJobExisting, saveEligibleAndAppliedJob } from "../../cloud/db/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { addToProcessStream } from "../../cloud/redis/index.ts";
import { DataJob, LINKEDIN_URL_JOB, isBlacklistedCompany, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsScraped, incrementJobsAutoApplied } from "../../utils/automationState.ts";
import { handleEasyApply } from "./auto_apply/index.ts";

const SELECTORS = {
  description: '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"], .show-more-less-html__markup, .description__text, .jobs-description__content, #job-details, div[class*="description"]',
  applyLink: 'a[href*="/jobs/view/"][href*="/apply/"], a[href*="/safety/go/"], a[aria-label="Apply on company website"]',
  companyName: '[aria-label^="Company,"]',
  role: 'div[data-display-contents="true"] p',
};

async function extractDescription(page: Page) {
  try {
    await page.waitForSelector('.show-more-less-html__markup, .jobs-description__content, [data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"], #job-details, div[class*="description"], [data-testid="expandable-text-box"]', {
      visible: true,
      timeout: 10000,
    });
  } catch {
  }

  return page.evaluate(() => {
    const selectors = [
      '[data-sdui-component="com.linkedin.sdui.generated.jobseeker.dsl.impl.aboutTheJob"]',
      '.show-more-less-html__markup',
      '.description__text',
      '.jobs-description__content',
      '#job-details',
      'div[class*="description"]',
      '[data-testid="expandable-text-box"]'
    ];
    
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el && el.textContent && el.textContent.trim().length > 50) {
        return el.textContent.trim();
      }
    }
    return null;
  });
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

  const urlObj = new URL(href);
  const encodedUrl = urlObj.searchParams.get("url");
  if (!encodedUrl) return href;

  return encodedUrl.trim();
}

async function extractCompanyName(page: Page) {
  return page.evaluate(() => {
    const labelEl = document.querySelector('[aria-label^="Company,"]');
    if (labelEl) {
      const label = labelEl.getAttribute("aria-label")?.trim();
      const match = label?.match(/^Company,\s*(.+?)\.$/);
      if (match && match[1]) return match[1].trim();
    }
    
    const companyLinks = Array.from(document.querySelectorAll('a[href*="/company/"]'));
    for (const link of companyLinks) {
       const text = link.textContent?.trim();
       if (text && text.length > 0) return text;
    }
    
    return null;
  });
}

async function extractRole(page: Page) {
  return page.evaluate(() => {
    const h1s = Array.from(document.querySelectorAll('h1'));
    for (const h1 of h1s) {
      if (h1.closest('header') || h1.closest('#global-nav')) continue;
      const text = h1.textContent?.trim();
      if (text && text.length > 3 && text !== "Me") {
        return text;
      }
    }
    
    const titleEl = document.querySelector('.top-card-layout__title, .topcard__title, .job-details-jobs-unified-top-card__job-title');
    if (titleEl && titleEl.textContent) {
       return titleEl.textContent.trim();
    }
    
    const jobLinks = Array.from(document.querySelectorAll('a[href*="/jobs/view/"]'));
    for (const link of jobLinks) {
       const text = link.textContent?.trim();
       if (text && text.length > 5 && !text.toLowerCase().includes("apply") && !text.toLowerCase().includes("save")) {
           return text;
       }
    }
    
    return null;
  });
}

async function extractData(browser: Browser, jobId: string) {
  const page = await browser.newPage();
  const applicationLink = `${LINKEDIN_URL_JOB}${jobId}`;
  try {
    await page.goto(applicationLink, { waitUntil: "domcontentloaded", timeout: 45000 });
  } catch (error) {
    console.log(`[LinkedIn] Navigation timeout for job ${jobId}. Skipping.`);
    try { if (!page.isClosed()) await page.close(); } catch (e) {}
    return;
  }

  await delay(WAIT_TIME);
  const companyName = (await extractCompanyName(page))?.trim();
  let link = (await extractLink(page, jobId))?.trim();
  const hasApplyLink = !!link;

  if (!link) {
    link = applicationLink;
  }
  const description = (await extractDescription(page))?.trim();
  const role = (await extractRole(page))?.trim() || '';

  let isEasyApply = false;
  if (hasApplyLink && link.includes("/jobs/view/") && link.includes("/apply")) {
    isEasyApply = true;
  } else {
    isEasyApply = await page.evaluate(() => {
      return !!document.querySelector('[aria-label="LinkedIn Apply to this job"]') || 
             !!document.querySelector('[aria-label="Easy Apply to this job"]') || 
             !!document.querySelector('svg#linkedin-bug-medium') ||
             !!document.querySelector('button[aria-label="Easy Apply to this job"]');
    });
  }

  const hasAnyApplyButton = await page.evaluate(() => {
      if (document.querySelector('.jobs-apply-button')) return true;
      if (document.querySelector('a[aria-label="Apply on company website"]')) return true;
      const allBtns = Array.from(document.querySelectorAll('button, a'));
      return allBtns.some(b => {
          const t = b.textContent?.trim().toLowerCase();
          return t === 'apply' || t === 'easy apply';
      });
  });

  const isAlreadyApplied = await page.evaluate(() => {
    const textNodes = Array.from(document.querySelectorAll('*'));
    return textNodes.some(node => {
      const text = node.textContent?.trim().toLowerCase();
      return text === 'applied' || text === 'application submitted';
    });
  });

  if (isAlreadyApplied) {
    console.log(`[LinkedIn] Job ${jobId} is already applied. Skipping.`);
    try { if (!page.isClosed()) await page.close(); } catch (error) {}
    return;
  }

  if (!hasApplyLink && !isEasyApply && !hasAnyApplyButton) {
      console.log(`[LinkedIn] No Apply or Easy Apply button found for job ${jobId}. Skipping.`);
      try { if (!page.isClosed()) await page.close(); } catch (error) {}
      return;
  }

  let autoApplySuccess = false;
  if (isEasyApply) {
    try {
      autoApplySuccess = await handleEasyApply(page, jobId);
    } catch (error) {
      console.error(`[LinkedIn] Auto apply encountered an error for job ${jobId}:`, error);
      autoApplySuccess = false;
    }
  }

  await delay(WAIT_TIME);
  try {
    if (!page.isClosed()) {
      await page.close();
    }
  } catch (error) {
    console.error(`[LinkedIn] Error closing page for job ${jobId}:`, error);
  }

  if (!companyName || !link || !description) {
      console.log(`[LinkedIn] Missing required data for job ${jobId}. companyName=${!!companyName}, link=${!!link}, description=${!!description}, role=${!!role}`);
      return;
  }
  if (isBlacklistedCompany(companyName)) return;

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

  let dbId: string;

  if (autoApplySuccess) dbId = await saveEligibleAndAppliedJob(data);
  else dbId = await saveJob(data);
  return { id: dbId, autoApplied: autoApplySuccess };

  // return null;
}

export async function getJobData(browser: Browser, jobIds: string[]) {
  const executing = new Set<Promise<void>>();
  
  for (const jobId of jobIds) {
    const processJob = async () => {
      try {
        const cleanJobId = jobId ? jobId.trim().toLowerCase() : "";
        if (!cleanJobId || await isJobExisting(cleanJobId)) return;

        const result = await extractData(browser, cleanJobId);
        if (result && result.id) {
          if (result.autoApplied) incrementJobsAutoApplied();
          else await addToProcessStream({ id: result.id });
          incrementJobsScraped();
        }
      } catch (err) {
        console.error(`Error processing job ${jobId}:`, err);
      }
    };

    const p = processJob();
    executing.add(p);
    p.finally(() => executing.delete(p));

    if (executing.size >= 3) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
}
