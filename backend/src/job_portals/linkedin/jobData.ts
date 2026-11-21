import { type Page } from "puppeteer-core";
import { ResilientBrowser } from "../../utils/resilientBrowser.ts";
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

async function extractRole(page: Page, companyName?: string | null) {
  return page.evaluate((compName) => {
    const cleanComp = (compName || "").trim().toLowerCase();

    const noiseTerms = [
      "·",
      "ago",
      "applicant",
      "clicked apply",
      "responses managed",
      "reposted",
      "promoted",
      "easy apply",
      "apply on company website",
      "full-time",
      "part-time",
      "contract",
      "temporary",
      "internship",
      "on-site",
      "hybrid",
      "remote",
      "view job",
      "save job",
      "more options",
      "sign in",
      "join now",
      "about the job",
      "company website",
      "verified job"
    ];

    // 1. Check dedicated job title selectors (traditional LinkedIn UI)
    const titleSelectors = [
      "h1.job-details-jobs-unified-top-card__job-title",
      "h1.t-24",
      "h1.t-bold",
      ".job-details-jobs-unified-top-card__job-title",
      ".jobs-unified-top-card__job-title",
      ".top-card-layout__title",
      ".topcard__title",
      "h1[class*='job-title']",
      "h2[class*='job-title']"
    ];

    for (const sel of titleSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = (el.textContent || "").trim();
        const lower = text.toLowerCase();
        if (
          text.length >= 3 &&
          (!cleanComp || (lower !== cleanComp && !cleanComp.includes(lower))) &&
          !noiseTerms.some((term) => lower.includes(term))
        ) {
          return text;
        }
      }
    }

    // 2. Check any h1 element on the page (excluding navigation/header)
    const h1s = Array.from(document.querySelectorAll("h1"));
    for (const h1 of h1s) {
      if (h1.closest("header") || h1.closest("#global-nav") || h1.closest("nav")) continue;
      const text = (h1.textContent || "").trim();
      const lower = text.toLowerCase();
      if (
        text.length >= 3 &&
        text !== "Me" &&
        (!cleanComp || (lower !== cleanComp && !cleanComp.includes(lower))) &&
        !noiseTerms.some((term) => lower.includes(term))
      ) {
        return text;
      }
    }

    // 3. New SDUI Layout: check elements inside data-display-contents="true"
    // e.g. <div data-display-contents="true"><p class="aaalje aaalq0 ...">AI Native Software Engineer ...</p></div>
    const displayElements = Array.from(
      document.querySelectorAll(
        'div[data-display-contents="true"] p, div[data-display-contents="true"] h1, div[data-display-contents="true"] h2'
      )
    );

    for (const el of displayElements) {
      // Must not be inside or contain a company link
      if (el.closest('a[href*="/company/"]') || el.querySelector('a[href*="/company/"]')) continue;
      if (el.closest('[aria-label^="Company,"]') || el.querySelector('[aria-label^="Company,"]')) continue;
      if (el.closest("button") || el.closest("figure") || el.closest("svg") || el.closest("a")) continue;

      // Extract text from the first meaningful text node to exclude child badges (like "Verified job")
      let text = "";
      for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
          const val = (node.textContent || "").trim();
          if (val.length >= 3) {
            text = val;
            break;
          }
        }
      }

      if (!text) {
        const clone = el.cloneNode(true) as HTMLElement;
        clone.querySelectorAll('[aria-label*="Verified"], a, svg, button, figure').forEach((n) => n.remove());
        text = (clone.textContent || "").trim();
      }

      const lower = text.toLowerCase();
      if (
        text.length >= 3 &&
        text.length <= 120 &&
        (!cleanComp || (lower !== cleanComp && !cleanComp.includes(lower))) &&
        !noiseTerms.some((term) => lower.includes(term))
      ) {
        return text;
      }
    }

    // 4. Check links pointing to /jobs/view/
    const jobLinks = Array.from(document.querySelectorAll('a[href*="/jobs/view/"]'));
    for (const link of jobLinks) {
      const text = (link.textContent || "").trim();
      const lower = text.toLowerCase();
      if (
        text.length >= 3 &&
        (!cleanComp || (lower !== cleanComp && !cleanComp.includes(lower))) &&
        !lower.includes("apply") &&
        !lower.includes("save") &&
        !noiseTerms.some((term) => lower.includes(term))
      ) {
        return text;
      }
    }

    // 5. Fallback: Parse document title (e.g. "AI Native Software Engineer at Accenture | LinkedIn")
    const docTitle = document.title || "";
    if (docTitle) {
      let clean = docTitle.replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
      if (cleanComp) {
        const hiringRegex = new RegExp(`^${cleanComp}\\s+hiring\\s+(.+?)(?:\\s+in\\s+.+)?$`, "i");
        const m = clean.match(hiringRegex);
        if (m && m[1]) return m[1].trim();
      }
      const genericHiring = clean.match(/^.+?\s+hiring\s+(.+?)(?:\s+in\\s+.+)?$/i);
      if (genericHiring && genericHiring[1]) return genericHiring[1].trim();

      if (clean.includes(" at ")) {
        const parts = clean.split(/\s+at\s+/i);
        const p0 = parts[0]?.trim() || "";
        const lower0 = p0.toLowerCase();
        if (
          p0.length > 2 &&
          (!cleanComp || (lower0 !== cleanComp && !cleanComp.includes(lower0))) &&
          !noiseTerms.some((term) => lower0.includes(term))
        ) {
          return p0;
        }
      }
      if (clean.includes(" - ")) {
        const parts = clean.split(/\s+-\s+/);
        const p0 = parts[0]?.trim() || "";
        const lower0 = p0.toLowerCase();
        if (
          p0.length > 2 &&
          (!cleanComp || (lower0 !== cleanComp && !cleanComp.includes(lower0))) &&
          !noiseTerms.some((term) => lower0.includes(term))
        ) {
          return p0;
        }
      }
    }

    return null;
  }, companyName);
}

async function safeClosePage(page: Page | null | undefined): Promise<void> {
  if (!page) return;
  try {
    if (!page.isClosed()) {
      await page.close();
    }
  } catch (err: any) {
    if (
      !err?.message?.includes("No target with given id found") &&
      !err?.message?.includes("Target closed")
    ) {
      console.warn("[LinkedIn] Notice during page.close:", err.message);
    }
  }
}

async function extractData(browser: ResilientBrowser, jobId: string) {
  const initialPages = await browser.pages();
  const page = await browser.newPage();
  await page.evaluateOnNewDocument(() => {
    if (typeof (window as any).__name === "undefined") {
      (window as any).__name = (target: any) => target;
    }
  });
  const applicationLink = `${LINKEDIN_URL_JOB}${jobId}`;
  try {
    try {
      await page.goto(applicationLink, { waitUntil: "domcontentloaded", timeout: 45000 });
    } catch (error) {
      console.log(`[LinkedIn] Navigation timeout for job ${jobId}. Skipping.`);
      return null;
    }

    await delay(WAIT_TIME);
    const companyName = (await extractCompanyName(page))?.trim();
    let link = (await extractLink(page, jobId))?.trim();
    const hasApplyLink = !!link;

    if (!link) {
      link = applicationLink;
    }
    const description = (await extractDescription(page))?.trim();
    const role = (await extractRole(page, companyName))?.trim() || '';

    let isEasyApply = false;
    if (hasApplyLink && link.includes("/jobs/view/") && link.includes("/apply")) {
      isEasyApply = true;
    } else {
      isEasyApply = await page.evaluate(() => {
        const externalBtn = document.querySelector('a[aria-label="Apply on company website"], a[href*="/safety/go/"], a.jobs-apply-button[target="_blank"]');
        if (externalBtn) return false;

        const easyApplyBtn = document.querySelector(
          '[aria-label="Easy Apply to this job"], [aria-label="LinkedIn Apply to this job"], button[aria-label="Easy Apply to this job"], button.jobs-apply-button'
        );
        if (!easyApplyBtn) return false;

        const text = (easyApplyBtn.textContent || '').trim().toLowerCase();
        if (text.includes('company website') || text.includes('company site') || text.includes('off linkedin')) {
          return false;
        }
        if (text.includes('easy apply')) return true;
        const hasBugInside = !!easyApplyBtn.querySelector('svg#linkedin-bug-medium, svg[data-test-icon*="linkedin"]');
        return hasBugInside;
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
      return null;
    }

    if (!hasApplyLink && !isEasyApply && !hasAnyApplyButton) {
        console.log(`[LinkedIn] No Apply or Easy Apply button found for job ${jobId}. Skipping.`);
        return null;
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

    if (!companyName || !link || !description) {
        console.log(`[LinkedIn] Missing required data for job ${jobId}. companyName=${!!companyName}, link=${!!link}, description=${!!description}, role=${!!role}`);
        return null;
    }
    if (isBlacklistedCompany(companyName)) return null;

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

  } finally {
    await safeClosePage(page);
    try {
      const currentPages = await browser.pages();
      for (const p of currentPages) {
        if (!initialPages.includes(p) && !p.isClosed()) {
          await safeClosePage(p);
        }
      }
    } catch (e) {}
  }
}

export async function getJobData(browser: ResilientBrowser, jobIds: string[]) {
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
