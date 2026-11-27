import { type Page } from "puppeteer-core";
import { ResilientBrowser } from "../../utils/resilientBrowser.ts";
import { saveJob, isJobExisting, saveEligibleAndAppliedJob } from "../../cloud/db/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { addToProcessStream } from "../../cloud/redis/index.ts";
import { DataJob, LINKEDIN_URL_JOB, isBlacklistedCompany, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsScraped, incrementJobsAutoApplied } from "../../utils/automationState.ts";
import { handleEasyApply } from "./auto_apply/index.ts";
import { safeClosePage } from "../../utils/popupManager.ts";

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
      "try premium",
      "premium",
      "₹0",
      "$0",
      "free trial",
      "month free",
      "free for",
      "upgrade",
      "reactivate",
      "subscription",
      "linkedin learning",
      "messaging",
      "notifications",
      "my network",
      "manage account",
      "sign in",
      "join now",
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
      "about the job",
      "company website",
      "verified job"
    ];

    const isBadRole = (text: string | null | undefined): boolean => {
      if (!text) return true;
      const lower = text.trim().toLowerCase();
      if (lower.length < 3 || lower.length > 120) return true;
      if (lower === "me" || lower === "home" || lower === "jobs") return true;
      if (cleanComp && (lower === cleanComp || cleanComp.includes(lower))) return true;
      return noiseTerms.some((term) => lower.includes(term));
    };

    // 1. JSON-LD structured data (highest fidelity, completely immune to DOM banners/ads)
    try {
      const ldScripts = Array.from(document.querySelectorAll('script[type="application/ld+json"]'));
      for (const script of ldScripts) {
        const raw = script.textContent?.trim();
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const item = Array.isArray(parsed)
          ? parsed.find((j: any) => j?.["@type"] === "JobPosting")
          : parsed?.["@type"] === "JobPosting"
            ? parsed
            : null;
        if (item && item.title && typeof item.title === "string") {
          const t = item.title.trim();
          if (!isBadRole(t)) {
            return t;
          }
        }
      }
    } catch { }

    // 2. OpenGraph Meta Tags (<meta property="og:title" content="...">)
    try {
      const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
      if (ogTitle) {
        let clean = ogTitle.replace(/\s*\|\s*LinkedIn.*$/i, "").trim();
        if (clean.includes(" at ")) {
          const titlePart = clean.split(/\s+at\s+/i)[0]?.trim();
          if (!isBadRole(titlePart)) return titlePart;
        } else if (!isBadRole(clean)) {
          return clean;
        }
      }
    } catch { }

    // 3. Primary Job Top-Card Container Elements (scoped explicitly to main / top card)
    const primaryTitleSelectors = [
      "h1.job-details-jobs-unified-top-card__job-title",
      ".job-details-jobs-unified-top-card__job-title h1",
      ".job-details-jobs-unified-top-card__job-title a",
      ".job-details-jobs-unified-top-card__job-title",
      "[data-view-name='job-title']",
      "h1[data-view-name='job-title']",
      ".jobs-unified-top-card__job-title",
      ".top-card-layout__title",
      ".topcard__title",
      "main h1[class*='job-title']",
      "main h2[class*='job-title']",
      "main .job-view-layout h1",
      "main .jobs-details h1",
      "main [data-view-name='job-full-details'] h1",
      "main h1"
    ];

    for (const sel of primaryTitleSelectors) {
      const elements = Array.from(document.querySelectorAll(sel));
      for (const el of elements) {
        if (
          el.closest("header") ||
          el.closest("#global-nav") ||
          el.closest("nav") ||
          el.closest("aside") ||
          el.closest(".scaffold-layout__aside") ||
          el.closest("[class*='premium']") ||
          el.closest("[class*='upsell']")
        ) {
          continue;
        }
        const text = (el.textContent || "").trim();
        if (!isBadRole(text)) {
          return text;
        }
      }
    }

    // 4. New SDUI Layout: check inside main div[data-display-contents="true"]
    const mainContainer = document.querySelector("main") || document.querySelector(".job-view-layout") || document.body;
    const displayElements = Array.from(
      mainContainer.querySelectorAll(
        'div[data-display-contents="true"] p, div[data-display-contents="true"] h1, div[data-display-contents="true"] h2'
      )
    );

    for (const el of displayElements) {
      if (
        el.closest("header") ||
        el.closest("nav") ||
        el.closest("aside") ||
        el.closest('a[href*="/company/"]') ||
        el.closest('[aria-label^="Company,"]') ||
        el.closest("button") ||
        el.closest("figure") ||
        el.closest("svg") ||
        el.closest("a") ||
        el.closest("[class*='premium']") ||
        el.closest("[class*='upsell']")
      ) {
        continue;
      }

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

      if (!isBadRole(text)) {
        return text;
      }
    }

    // 5. Fallback: Parse document title (e.g. "Software Engineer at Google | LinkedIn")
    const docTitle = document.title || "";
    if (docTitle) {
      let clean = docTitle.replace(/\s*\|\s*LinkedIn.*$/i, "").trim();

      // Check "Company hiring Role in Location"
      if (cleanComp) {
        const hiringRegex = new RegExp(`^${cleanComp}\\s+hiring\\s+(.+?)(?:\\s+in\\s+.+)?$`, "i");
        const m = clean.match(hiringRegex);
        if (m && m[1] && !isBadRole(m[1].trim())) return m[1].trim();
      }
      const genericHiring = clean.match(/^.+?\s+hiring\s+(.+?)(?:\s+in\s+.+)?$/i);
      if (genericHiring && genericHiring[1] && !isBadRole(genericHiring[1].trim())) {
        return genericHiring[1].trim();
      }

      // Check "Role at Company"
      if (clean.includes(" at ")) {
        const p0 = clean.split(/\s+at\s+/i)[0]?.trim() || "";
        if (!isBadRole(p0)) return p0;
      }

      // Check "Role - Company" or "Role | Company"
      if (clean.includes(" - ")) {
        const p0 = clean.split(/\s+-\s+/)[0]?.trim() || "";
        if (!isBadRole(p0)) return p0;
      }
      if (clean.includes(" | ")) {
        const p0 = clean.split(/\s+\|\s+/)[0]?.trim() || "";
        if (!isBadRole(p0)) return p0;
      }

      if (!isBadRole(clean)) return clean;
    }

    return null;
  }, companyName);
}

async function checkLinkedInApplyStatus(page: Page): Promise<{
  isAlreadyApplied: boolean;
  isExpired: boolean;
  hasApplyButton: boolean;
  isEasyApply: boolean;
  isExternalApply: boolean;
  externalLink: string | null;
}> {
  return await page.evaluate(() => {
    const textAll = (document.body.innerText || '').toLowerCase();

    // 1. Check if already applied
    const alreadyAppliedTexts = ['applied', 'application submitted', 'applied on'];
    const isAlreadyApplied = Array.from(document.querySelectorAll('span, button, p, div')).some(node => {
      if (node.children.length > 0) return false;
      const t = (node.textContent || '').trim().toLowerCase();
      return alreadyAppliedTexts.includes(t);
    });

    if (isAlreadyApplied) {
      return {
        isAlreadyApplied: true,
        isExpired: false,
        hasApplyButton: false,
        isEasyApply: false,
        isExternalApply: false,
        externalLink: null
      };
    }

    // 2. Check if job is expired or closed
    const isClosedBanner = (
      textAll.includes('no longer accepting applications') ||
      textAll.includes('this job is closed') ||
      textAll.includes('job is closed') ||
      textAll.includes('applications are no longer being accepted') ||
      textAll.includes('this job has expired') ||
      textAll.includes('job expired') ||
      document.querySelector('[data-test-job-expired-banner], .jobs-details__top-card--closed') !== null
    );

    // 3. Look for apply buttons strictly within the job details / top card action area
    // (Explicitly exclude sidebar recommendations, similar jobs, footer, etc.)
    const excludeSelectors = 'aside, .jobs-similar-jobs, .artdeco-dropdown, footer, #compactfooter-current-year, nav';

    // A. External Apply ("Apply on company website" or "/safety/go/")
    const externalLinks = Array.from(document.querySelectorAll<HTMLAnchorElement>(
      'a[aria-label="Apply on company website"], a[href*="/safety/go/"], a.jobs-apply-button[target="_blank"]'
    )).filter(el => !el.closest(excludeSelectors));

    let externalLink: string | null = null;
    let isExternalApply = false;

    if (externalLinks.length > 0) {
      isExternalApply = true;
      const rawHref = externalLinks[0].href || externalLinks[0].getAttribute('href') || '';
      try {
        const urlObj = new URL(rawHref, window.location.origin);
        const encodedUrl = urlObj.searchParams.get('url');
        externalLink = encodedUrl ? decodeURIComponent(encodedUrl) : rawHref;
      } catch {
        externalLink = rawHref;
      }
    }

    // B. Easy Apply
    let isEasyApply = false;
    const easyApplyCandidates = Array.from(document.querySelectorAll<HTMLElement>(
      '[aria-label="Easy Apply to this job"], [aria-label="LinkedIn Apply to this job"], button.jobs-apply-button'
    )).filter(el => !el.closest(excludeSelectors));

    for (const btn of easyApplyCandidates) {
      const text = (btn.textContent || '').trim().toLowerCase();
      const aria = (btn.getAttribute('aria-label') || '').toLowerCase();
      const href = btn.getAttribute('href') || '';

      if (
        text.includes('company website') ||
        text.includes('company site') ||
        text.includes('off linkedin') ||
        aria.includes('company website') ||
        href.includes('/safety/go/')
      ) {
        isExternalApply = true;
        if (!externalLink && href) externalLink = href;
      } else if (
        text.includes('easy apply') ||
        aria.includes('easy apply') ||
        btn.querySelector('svg#linkedin-bug-medium, svg[data-test-icon*="linkedin"]')
      ) {
        isEasyApply = true;
        break;
      }
    }

    // C. General apply button in the job's main header / top card
    const topCardContainer = document.querySelector(
      '.jobs-unified-top-card, .job-details-jobs-unified-top-card__container--two-pane, .jobs-details__main-content, div[data-display-contents="true"]'
    );
    
    let hasGeneralApply = false;
    if (topCardContainer) {
      const btns = Array.from(topCardContainer.querySelectorAll<HTMLElement>('button, a')).filter(el => !el.closest(excludeSelectors));
      for (const b of btns) {
        const t = (b.textContent || '').trim().toLowerCase();
        const aria = (b.getAttribute('aria-label') || '').toLowerCase();
        if (
          b.classList.contains('jobs-apply-button') ||
          t === 'apply' ||
          t === 'easy apply' ||
          aria.includes('apply to this job')
        ) {
          hasGeneralApply = true;
          if (b.getAttribute('target') === '_blank' || (b as HTMLAnchorElement).href?.includes('/safety/go/')) {
            isExternalApply = true;
            if (!externalLink) externalLink = (b as HTMLAnchorElement).href;
          }
          break;
        }
      }
    }

    const hasApplyButton = (isEasyApply || isExternalApply || hasGeneralApply) && !isClosedBanner;
    const isExpired = isClosedBanner || !hasApplyButton;

    return {
      isAlreadyApplied,
      isExpired,
      hasApplyButton,
      isEasyApply: isEasyApply && !isClosedBanner,
      isExternalApply: isExternalApply && !isClosedBanner,
      externalLink
    };
  });
}

async function extractData(browser: ResilientBrowser, jobId: string) {
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

    // 1. Check apply status immediately before running heavier extractions
    const status = await checkLinkedInApplyStatus(page);

    if (status.isAlreadyApplied) {
      console.log(`[LinkedIn] Job ${jobId} is already applied. Skipping.`);
      return null;
    }

    // For any job without an apply button (no Easy Apply, no Apply on site), consider it expired, ignore, close tab and move on
    if (status.isExpired || !status.hasApplyButton) {
      console.log(`[LinkedIn] Job ${jobId} has no apply button / is expired or closed. Ignoring and moving on.`);
      return null;
    }

    // 2. Only if the job is active and has a valid apply option, extract details
    const companyName = (await extractCompanyName(page))?.trim();
    const description = (await extractDescription(page))?.trim();
    const role = (await extractRole(page, companyName))?.trim() || '';

    if (!companyName || !description) {
      console.log(`[LinkedIn] Missing required data for job ${jobId}. companyName=${!!companyName}, description=${!!description}, role=${!!role}`);
      return null;
    }

    if (isBlacklistedCompany(companyName)) {
      console.log(`[LinkedIn] Company ${companyName} is blacklisted for job ${jobId}. Skipping.`);
      return null;
    }

    let link = status.externalLink || (await extractLink(page, jobId))?.trim() || applicationLink;

    let autoApplySuccess = false;
    if (status.isEasyApply) {
      try {
        autoApplySuccess = await handleEasyApply(page, jobId);
      } catch (error) {
        console.error(`[LinkedIn] Auto apply encountered an error for job ${jobId}:`, error);
        autoApplySuccess = false;
      }
    }

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
