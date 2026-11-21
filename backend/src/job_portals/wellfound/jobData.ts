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
    // 1. Locate the Slide-In Container to avoid extracting from background feed
    const slideIn = document.querySelector(
      '[data-test="JobDescriptionSlideIn"], [data-test*="SlideIn"], [class*="JobDescriptionSlideIn"], [role="dialog"]'
    );
    const submitBtn = document.querySelector('button[data-test="JobDescriptionSlideIn--SubmitButton"]');
    const successBanner = document.querySelector('div.bg-green-600, div[class*="bg-green-"], div[class*="bg-emerald-"]');
    const anchor = slideIn || submitBtn || successBanner;

    let container: Element | Document = document;
    if (slideIn) {
      container = slideIn;
    } else if (anchor) {
      let curr: Element | null = anchor;
      while (curr && curr.tagName !== 'BODY') {
        if (curr.querySelector('h1')) {
          container = curr;
          break;
        }
        curr = curr.parentElement;
      }
    }

    const role = container.querySelector('h1')?.textContent?.trim() || '';

    // 2. Extract Company Name from within the container
    let companyName = null;
    const companyAnchors = Array.from(container.querySelectorAll('a[href^="/company/"]'));
    for (const a of companyAnchors) {
      // Prioritize span text if it exists (new UI)
      const span = a.querySelector('span');
      const text = span ? span.textContent?.trim() : a.textContent?.trim();

      if (text && !a.querySelector('img')) {
        companyName = text;
        break;
      }
    }

    const topListItems = Array.from(
      container.querySelectorAll('ul.flex.flex-wrap.text-md.text-black li, ul.flex.flex-wrap li')
    );
    let salary = '';
    let experience = '';

    for (const li of topListItems) {
      const text = li.textContent?.trim() || '';
      if (text.includes('₹') || text.includes('$')) {
        salary = text;
      }
      if (text.includes('exp') || text.toLowerCase().includes('year')) {
        experience = text.replace('|', '').trim();
      }
    }

    const locationSpan = Array.from(container.querySelectorAll('span')).find(
      el => el.textContent?.trim() === 'Job Location' || el.textContent?.trim() === 'Location'
    );
    const location = locationSpan?.nextElementSibling?.textContent?.trim() || '';

    const skillsSpan = Array.from(container.querySelectorAll('span')).find(
      el => el.textContent?.trim() === 'Skills'
    );
    const skillsContainer = skillsSpan?.nextElementSibling;
    const skills = skillsContainer
      ? Array.from(skillsContainer.children).map(el => el.textContent?.trim()).filter(Boolean).join(', ')
      : '';

    const about = container.querySelector('#job-description')?.textContent?.trim() || '';

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

      // Find slide-in container if present, or fallback to document
      const slideIn = document.querySelector(
        '[data-test="JobDescriptionSlideIn"], [data-test*="SlideIn"], [class*="JobDescriptionSlideIn"], [role="dialog"]'
      ) || document;

      // 1. Check green / emerald confirmation banner (e.g. bg-green-600)
      const greenBanner = slideIn.querySelector(
        'div.bg-green-600, div[class*="bg-green-"], div[class*="bg-emerald-"], [class*="bg-green-600"], [class*="bg-emerald-600"]'
      );
      if (greenBanner) {
        return true;
      }

      // 2. Applied phrases to look for in container text
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

      const allText = normalize(slideIn.textContent || "");
      if (appliedPhrases.some(phrase => allText.includes(phrase))) {
        return true;
      }

      // 3. Check buttons, badges, tags, and status pills inside slideIn
      const badgesAndButtons = Array.from(
        slideIn.querySelectorAll(
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
          text === "application submitted"
        ) {
          return true;
        }
      }

      // 4. Check disabled apply button with applied text
      const disabledBtn = slideIn.querySelector('button[disabled]');
      if (disabledBtn && normalize(disabledBtn.textContent || "").includes("applied")) {
        return true;
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
    let initialPages: Page[] = [];
    try {
      const cleanJobId = jobId ? jobId.trim().toLowerCase() : "";
      if (!cleanJobId || await isJobExisting(cleanJobId)) {
        console.log(`[Wellfound] Skipping ${cleanJobId}: Already exists in DB or empty.`);
        continue;
      }
      console.log(`[Wellfound] Navigating to apply for job ID: ${cleanJobId}`);

      initialPages = await resilientBrowser.pages();
      page = await resilientBrowser.newPage();
      const applicationLink = `${WELLFOUND_URL_JOB}${cleanJobId}`;
      await page.goto(applicationLink, { waitUntil: "load" });
      await delay(WAIT_TIME);

      const data = await extractData(page, jobId);
      await delay(WAIT_TIME);

      const { role, companyName, salary, experience, location, skills, about } = data;

      if (!companyName || !about) {
        console.log(`[Wellfound] Missing company name or description for job ID: ${cleanJobId}. Skipping.`);
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
      try {
        const currentPages = await resilientBrowser.pages();
        for (const p of currentPages) {
          if (!initialPages.includes(p) && !p.isClosed()) {
            await safeClosePage(p);
          }
        }
      } catch (e) {}
    }
  }
}
