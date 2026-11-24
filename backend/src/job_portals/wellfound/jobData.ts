import { type Page } from "puppeteer-core";
import { ResilientBrowser } from "../../utils/resilientBrowser.ts";
import { saveJob, saveEligibleAndAppliedJob, isJobExisting } from "../../cloud/db/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { addToProcessStream } from "../../cloud/redis/index.ts";
import { DataJob, WELLFOUND_URL_JOB, isBlacklistedCompany, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsScraped, incrementJobsAutoApplied } from "../../utils/automationState.ts";

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
      console.warn("[Wellfound] Notice during page.close:", err.message);
    }
  }
}

async function extractData(page: Page, jobId: string) {
  return await page.evaluate(() => {
    // 1. Identify the Active Job Card
    const companyHeader = document.querySelector('[data-test="JobListingCompanyHeader"]');
    const jobDescEl = document.querySelector('#job-description');
    const slideIn = document.querySelector(
      '[data-test="JobDescriptionSlideIn"], [data-test*="SlideIn"], [class*="JobDescriptionSlideIn"], [role="dialog"]'
    );

    // Find the closest card container wrapping the active job
    const activeCard: Element | Document = 
      companyHeader?.closest('div[class*="rounded-xl"]') ||
      jobDescEl?.closest('div[class*="rounded-xl"]') ||
      companyHeader?.parentElement ||
      slideIn ||
      document;

    // 2. Role Extraction
    let role = '';
    const isNoiseRole = (text: string | null | undefined): boolean => {
      if (!text) return true;
      const lower = text.trim().toLowerCase();
      return (
        lower.length < 3 ||
        lower === 'search for jobs' ||
        lower.startsWith('search for jobs') ||
        lower.includes('search for jobs') ||
        lower === 'wellfound' ||
        lower === 'jobs' ||
        lower === 'overview' ||
        lower === 'discover'
      );
    };

    const roleCandidates = Array.from(
      activeCard.querySelectorAll('h1.inline, h1.text-xl, h1.font-semibold, h1[class*="text-xl"], h1')
    ).concat(
      Array.from(document.querySelectorAll('h1.inline, h1.text-xl, h1.font-semibold, h1[class*="text-xl"], h1'))
    );

    for (const h of roleCandidates) {
      const t = h.textContent?.trim() || '';
      if (!isNoiseRole(t)) {
        role = t;
        break;
      }
    }

    // 3. Extract Company Name
    let companyName: string | null = null;

    // a. Directly from [data-test="JobListingCompanyHeader"] (Wellfound's dedicated company header)
    if (companyHeader) {
      // Check font-semibold span inside company link: <a href="/company/..."><span class="text-sm font-semibold text-black">The Ninja Studio</span></a>
      const nameSpan = companyHeader.querySelector(
        'a[href*="/company/"] span.font-semibold, a[href*="/startup/"] span.font-semibold, a[href*="/company/"] span, a[href*="/startup/"] span, span.font-semibold'
      );
      const spanText = nameSpan?.textContent?.trim();
      if (spanText && spanText.length > 1 && !spanText.toLowerCase().includes('actively hiring')) {
        companyName = spanText;
      }

      // Check avatar image alt: <img alt="Avatar for The Ninja Studio" ...>
      if (!companyName) {
        const avatarImg = companyHeader.querySelector('img[alt^="Avatar for " i], img[alt]');
        const altText = avatarImg?.getAttribute('alt')?.trim();
        if (altText) {
          const cleanAlt = altText.replace(/^Avatar for\s+/i, '').replace(/\s+logo$/i, '').trim();
          if (cleanAlt.length > 1) {
            companyName = cleanAlt;
          }
        }
      }

      // Check company anchor directly (excluding logo-only img anchors)
      if (!companyName) {
        const anchors = Array.from(companyHeader.querySelectorAll('a[href*="/company/"], a[href*="/startup/"]'));
        for (const a of anchors) {
          if (a.querySelector('img') && !a.textContent?.trim()) continue;
          const text = a.textContent?.trim();
          if (text && text.length > 1 && !text.toLowerCase().includes('actively hiring')) {
            companyName = text;
            break;
          }
        }
      }
    }

    // b. From activeCard if companyHeader was not present
    if (!companyName && activeCard !== document) {
      const companyAnchors = Array.from(activeCard.querySelectorAll('a[href*="/company/"], a[href*="/startup/"]'));
      for (const a of companyAnchors) {
        if (a.querySelector('img') && !a.textContent?.trim()) continue;
        const span = a.querySelector('span.font-semibold, span');
        const text = (span ? span.textContent : a.textContent)?.trim();
        if (
          text &&
          text.length > 1 &&
          !text.toLowerCase().includes('wellfound') &&
          !text.toLowerCase().includes('overview') &&
          !text.toLowerCase().includes('actively hiring')
        ) {
          companyName = text;
          break;
        }
      }

      if (!companyName) {
        const logoImg = activeCard.querySelector('img[alt*="Avatar for " i], img[alt*="logo" i]');
        if (logoImg) {
          const alt = logoImg.getAttribute('alt') || '';
          const cleaned = alt.replace(/^Avatar for\s+/i, '').replace(/\s+logo$/i, '').trim();
          if (cleaned.length > 1) companyName = cleaned;
        }
      }
    }

    // c. Fallback to document.title ("Role at Company | Wellfound" or "Company is hiring...")
    if (!companyName && document.title) {
      const cleanTitle = document.title.replace(/\s*\|\s*Wellfound.*$/i, '').trim();
      if (cleanTitle.includes(' at ')) {
        companyName = cleanTitle.split(/\s+at\s+/i)[1]?.trim() || null;
      } else if (cleanTitle.includes(' is hiring ')) {
        companyName = cleanTitle.split(/\s+is hiring\s+/i)[0]?.trim() || null;
      }
    }

    // 4. Top meta items: Experience, Salary, Location
    // <ul class="flex flex-wrap text-md text-black">
    //   <li>₹6L – ₹10L • No equity</li>
    //   <li>Remote (India)</li>
    //   <li>| 2 years of exp</li>
    //   <li>| Full Time</li>
    // </ul>
    const topListItems = Array.from(
      activeCard.querySelectorAll('ul.flex.flex-wrap li, ul[class*="text-md"] li')
    ).concat(
      Array.from(document.querySelectorAll('ul.flex.flex-wrap li, ul[class*="text-md"] li'))
    );

    let salary = '';
    let experience = '';

    for (const li of topListItems) {
      const raw = li.textContent || '';
      const text = raw.replace(/^[|•\s]+/, '').replace(/[|•\s]+$/, '').trim();
      if ((text.includes('₹') || text.includes('$')) && !salary) {
        salary = text;
      }
      if ((text.toLowerCase().includes('exp') || text.toLowerCase().includes('year')) && !experience) {
        experience = text.replace(/^\|\s*/, '').trim();
      }
    }

    // 5. Location
    let location = activeCard.querySelector('a[href*="/location/"]')?.textContent?.trim() ||
                   document.querySelector('a[href*="/location/"]')?.textContent?.trim() || '';

    if (!location) {
      location = activeCard.querySelector('a[href*="/remote"]')?.textContent?.trim() ||
                 document.querySelector('a[href*="/remote"]')?.textContent?.trim() || '';
    }

    if (!location) {
      const locationSpan = Array.from(activeCard.querySelectorAll('span'))
        .concat(Array.from(document.querySelectorAll('span')))
        .find(el => {
          const t = el.textContent?.trim() || '';
          return t === 'Job Location' || t === 'Company Location' || t === 'Location' || t === 'Hires remotely in';
        });
      if (locationSpan) {
        const parent = locationSpan.closest('div');
        const locLink = parent?.querySelector('a, div.flex, p');
        location = locLink?.textContent?.trim() || '';
      }
    }

    // 6. Skills:
    // <span class="text-md font-semibold">Skills</span>
    // <div class="flex flex-wrap"><div class="...">PHP</div>...</div>
    let skills = '';
    const skillsSpan = Array.from(activeCard.querySelectorAll('span'))
      .concat(Array.from(document.querySelectorAll('span')))
      .find(el => el.textContent?.trim() === 'Skills');

    if (skillsSpan) {
      const parentDiv = skillsSpan.closest('div');
      if (parentDiv) {
        const skillBadges = Array.from(parentDiv.querySelectorAll('div[class*="rounded"], div.flex.flex-wrap > div'));
        const filtered = skillBadges
          .map(el => el.textContent?.trim() || '')
          .filter(t => t && t !== 'Skills');
        skills = Array.from(new Set(filtered)).join(', ');
      }
    }

    // 7. About the job / Description:
    // <div class="styles_description__xjvTf inline-block text-black" id="job-description">
    let about = activeCard.querySelector('#job-description, [data-test="JobDescription"], [class*="styles_description_"], [class*="jobDescription"]')
      ?.textContent?.trim() ||
      document.querySelector('#job-description, [data-test="JobDescription"], [class*="styles_description_"], [class*="jobDescription"]')
      ?.textContent?.trim() || '';

    if (!about) {
      const aboutHeader = Array.from(activeCard.querySelectorAll('h2, h3, span'))
        .concat(Array.from(document.querySelectorAll('h2, h3, span')))
        .find(el => {
          const t = el.textContent?.trim().toLowerCase() || '';
          return t.includes('about the job') || t.includes('about the role');
        });
      if (aboutHeader && aboutHeader.parentElement) {
        about = aboutHeader.parentElement.textContent?.trim() || '';
      }
    }

    return {
      role,
      companyName,
      salary,
      experience,
      location,
      skills,
      about
    };
  });
}

async function isApplicationSubmitted(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const normalize = (str: string) => str.replace(/\s+/g, " ").trim().toLowerCase();

      // 1. Direct body text search (immune to any CSS/DOM class changes)
      const bodyText = normalize(document.body.innerText || document.body.textContent || "");
      const appliedPhrases = [
        "congrats! your application has been submitted",
        "your application has been submitted",
        "application has been submitted",
        "application submitted",
        "already applied",
        "you have applied",
        "you have already applied",
        "you've already applied",
        "you already applied",
        "you applied",
        "application received",
        "application sent",
        "your application was sent",
        "applied on",
        "applied to this job",
        "application status"
      ];

      if (appliedPhrases.some(phrase => bodyText.includes(phrase))) {
        return true;
      }

      // 2. Green / emerald confirmation banner (e.g. bg-green-600)
      const greenBanner = document.querySelector(
        'div.bg-green-600, [class*="bg-green-600"], div[class*="bg-green-"], div[class*="bg-emerald-"], [class*="bg-emerald-600"]'
      );
      if (greenBanner) {
        const text = normalize(greenBanner.textContent || "");
        if (
          text.includes("submitted") ||
          text.includes("applied") ||
          text.includes("congrats") ||
          text.includes("application")
        ) {
          return true;
        }
      }

      // 3. Status pills, badges, buttons across document
      const badgesAndButtons = Array.from(
        document.querySelectorAll(
          'button, a, [data-test], [class*="badge"], [class*="tag"], [class*="status"], [class*="pill"], span, div'
        )
      );

      for (const el of badgesAndButtons) {
        const text = normalize(el.textContent || "");
        if (
          text === "applied" ||
          text === "✓ applied" ||
          text === "applied ✓" ||
          text.startsWith("applied on") ||
          text.startsWith("applied ") ||
          text.includes("already applied") ||
          text.includes("you applied") ||
          text === "application submitted" ||
          text.includes("application has been submitted")
        ) {
          return true;
        }
      }

      // 4. Disabled buttons with applied text
      const disabledButtons = Array.from(document.querySelectorAll('button[disabled], [aria-disabled="true"]'));
      for (const btn of disabledButtons) {
        const text = normalize(btn.textContent || "");
        if (text.includes("applied") || text.includes("submitted")) {
          return true;
        }
      }

      return false;
    });
  } catch {
    return false;
  }
}

async function tryApplyJob(page: Page): Promise<boolean> {
  try {
    const submitBtnSelector = 'button[data-test="JobDescriptionSlideIn--SubmitButton"]';

    // 1. Poll for either application status (already applied) or the Apply button
    // Wellfound fetches user application status via GraphQL on client mount, which takes 1-3 seconds.
    let applyBtn: import('puppeteer-core').ElementHandle<Element> | null = null;
    const maxPollAttempts = 10;

    for (let attempt = 0; attempt < maxPollAttempts; attempt++) {
      if (await isApplicationSubmitted(page)) {
        console.log("[Wellfound] Application is already submitted (detected on page load/hydration).");
        return true;
      }

      applyBtn = await page.$(submitBtnSelector);
      if (!applyBtn) {
        const applyBtnHandle = await page.evaluateHandle(() => {
          const btns = Array.from(document.querySelectorAll('button[data-test*="SubmitButton"], button'));
          return btns.find(b => {
            const t = (b.textContent || "").trim().toLowerCase();
            return t === 'apply' || t === 'apply now' || t === 'quick apply' || t === 'submit application';
          }) || null;
        });
        applyBtn = applyBtnHandle.asElement() as import('puppeteer-core').ElementHandle<Element> | null;
      }

      if (applyBtn) {
        break;
      }

      await delay(500);
    }

    // Final check for already applied
    if (await isApplicationSubmitted(page)) {
      console.log("[Wellfound] Application is already submitted.");
      return true;
    }

    if (!applyBtn) {
      // If no apply button exists after 5 seconds of polling and the job description is loaded,
      // the job is either already applied or closed/no longer accepting applications.
      console.log("[Wellfound] No Apply button found after polling. Considering job as already applied / closed.");
      return true;
    }

    const isDisabled = await page.evaluate((btn) => (btn as HTMLButtonElement).disabled, applyBtn);
    if (isDisabled) {
      console.log("[Wellfound] Apply button is disabled. Considering job as already applied.");
      return true;
    }

    // Scroll into view & click with real CDP mouse events, fallback to evaluate click
    try {
      await page.evaluate((btn) => {
        (btn as HTMLElement).scrollIntoView({ behavior: 'instant', block: 'center' });
      }, applyBtn);
      await delay(300);
      await applyBtn.click({ delay: 50 });
    } catch {
      await page.evaluate((btn) => (btn as HTMLButtonElement).click(), applyBtn);
    }

    // 2. Poll for confirmation banner
    const maxWaitMs = 10000;
    const intervalMs = 500;
    const iterations = maxWaitMs / intervalMs;

    for (let i = 0; i < iterations; i++) {
      await delay(intervalMs);
      if (await isApplicationSubmitted(page)) {
        console.log("[Wellfound] Application confirmed via success banner!");
        await delay(WAIT_TIME);
        return true;
      }
    }

    return await isApplicationSubmitted(page);
  } catch (error) {
    console.error("[Wellfound] Error in tryApplyJob:", error);
    return false;
  }
}

export async function getJobData(resilientBrowser: ResilientBrowser, jobIds: string[]) {
  console.log(`[Wellfound] Starting to process ${jobIds.length} job(s)...`);

  for (const jobId of jobIds) {
    let page: Page | null = null;
    try {
      const cleanJobId = jobId ? jobId.trim().toLowerCase() : "";
      if (!cleanJobId || await isJobExisting(cleanJobId)) {
        console.log(`[Wellfound] Skipping ${cleanJobId}: Already exists in DB or empty.`);
        continue;
      }
      console.log(`[Wellfound] Navigating to apply for job ID: ${cleanJobId}`);

      page = await resilientBrowser.newPage();
      const applicationLink = `${WELLFOUND_URL_JOB}${cleanJobId}`;
      try {
        await page.goto(applicationLink, { waitUntil: "domcontentloaded", timeout: 45000 });
      } catch (navErr: any) {
        console.warn(`[Wellfound] Navigation timeout or error for job ID ${cleanJobId}:`, navErr.message);
        continue;
      }
      try {
        await page.waitForSelector('h1, #job-description', { timeout: 10000 });
      } catch {}
      await delay(WAIT_TIME);

      const data = await extractData(page, jobId);
      await delay(WAIT_TIME);

      const { role, companyName, salary, experience, location, skills, about } = data;
      console.log(`[Wellfound] Job ID ${cleanJobId} parsed: Role="${role}", Company="${companyName}"`);

      if (!companyName || !about) {
        console.log(`[Wellfound] Missing company name or description for job ID: ${cleanJobId}. Skipping. (company=${companyName}, about=${!!about})`);
        continue;
      }

      if (isBlacklistedCompany(companyName)) {
        console.log(`[Wellfound] Company ${companyName} is blacklisted for job ID: ${cleanJobId}. Skipping.`);
        continue;
      }

      const fullDescription = [
        salary ? `Salary: ${salary}` : "",
        location ? `Location: ${location}` : "",
        experience ? `Experience: ${experience}` : "",
        skills ? `Skills: ${skills}` : "",
        about ? `About:\n${about}` : ""
      ].filter(Boolean).join("\n\n");

      const jobData: DataJob = {
        id: null,
        sourceName: "Wellfound",
        sourceJobId: jobId,
        companyName,
        jobId: null,
        description: fullDescription,
        link: applicationLink,
        portal_link: applicationLink,
        role
      };

      const applied = await tryApplyJob(page);

      if (applied) {
        console.log(`[Wellfound] Applied successfully for job ID: ${cleanJobId}`);
        await saveEligibleAndAppliedJob(jobData);
        incrementJobsAutoApplied();
        incrementJobsScraped();
      } else {
        console.log(`[Wellfound] Failed to auto-apply for job ID: ${cleanJobId}. Saving to DB and stream.`);
        const id = await saveJob(jobData);
        if (id) {
          await addToProcessStream({ id });
          incrementJobsScraped();
        }
      }

      await delay(WAIT_TIME);
    } catch (err) {
      console.error(`[Wellfound] Error processing job ID ${jobId}:`, err);
    } finally {
      await safeClosePage(page);
    }
  }
}
