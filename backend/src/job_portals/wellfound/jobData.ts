import { type Page } from "puppeteer-core";
import { ResilientBrowser } from "../../utils/resilientBrowser.ts";
import { saveJob, saveEligibleAndAppliedJob, isJobExisting } from "../../cloud/db/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { addToProcessStream } from "../../cloud/redis/index.ts";
import { DataJob, WELLFOUND_URL_JOB, isBlacklistedCompany, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsScraped, incrementJobsAutoApplied } from "../../utils/automationState.ts";

async function extractData(page: Page, jobId: string) {
  return await page.evaluate(() => {
    // 1. Locate the Slide-In Container to avoid extracting from the background feed
    const submitBtn = document.querySelector('button[data-test="JobDescriptionSlideIn--SubmitButton"]');
    const successBanner = document.querySelector('div.bg-green-600, div[class*="bg-green-"]');
    const anchor = submitBtn || successBanner;
    let container: Element | Document = document;
    if (anchor) {
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

    const topListItems = Array.from(container.querySelectorAll('ul.flex.flex-wrap.text-md.text-black li, ul.flex.flex-wrap li'));
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

    const locationSpan = Array.from(container.querySelectorAll('span')).find(el => el.textContent?.trim() === 'Job Location' || el.textContent?.trim() === 'Location');
    // For location, the text is inside a sibling div, sometimes wrapped in an anchor
    const location = locationSpan?.nextElementSibling?.textContent?.trim() || '';

    const skillsSpan = Array.from(container.querySelectorAll('span')).find(el => el.textContent?.trim() === 'Skills');
    const skillsContainer = skillsSpan?.nextElementSibling;
    // Use immediate children instead of querying all divs to prevent nested text duplication
    const skills = skillsContainer ? Array.from(skillsContainer.children).map(el => el.textContent?.trim()).filter(Boolean).join(', ') : '';

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
      const phrases = [
        "congrats! your application has been submitted",
        "your application has been submitted",
        "application has been submitted",
        "application submitted"
      ];

      // 1. Check green banner elements (e.g. div.bg-green-600)
      const greenElements = Array.from(document.querySelectorAll('div.bg-green-600, div[class*="bg-green-"], div[class*="bg-emerald-"]'));
      for (const el of greenElements) {
        const text = normalize(el.textContent || "");
        if (phrases.some(p => text.includes(p))) {
          return true;
        }
      }

      // 2. Check all container elements
      const elements = Array.from(document.querySelectorAll('div, p, span, h1, h2, h3'));
      for (const el of elements) {
        const text = normalize(el.textContent || "");
        if (phrases.some(p => text.includes(p))) {
          return true;
        }
      }

      // 3. Check body text
      const bodyText = normalize(document.body.innerText || document.body.textContent || "");
      if (phrases.some(p => bodyText.includes(p))) {
        return true;
      }

      // 4. Check if button / badge text says "Applied"
      const buttons = Array.from(document.querySelectorAll('button, a, [data-test], [class*="badge"], [class*="tag"]'));
      for (const btn of buttons) {
        const btnText = normalize(btn.textContent || "");
        if (btnText === "applied" || btnText === "application submitted") {
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
    await delay(WAIT_TIME);

    // 1. Check if the job is ALREADY applied on page load
    if (await isApplicationSubmitted(page)) {
      console.log("[Wellfound] Application is already submitted (detected success banner on page load).");
      return true;
    }

    const submitBtnSelector = 'button[data-test="JobDescriptionSlideIn--SubmitButton"]';
    let applyBtn: import('puppeteer-core').ElementHandle<Element> | null = await page.$(submitBtnSelector);

    // Fallback: look for other potential apply buttons inside slide-in container or page
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

    if (!applyBtn) {
      // Re-check if already submitted
      if (await isApplicationSubmitted(page)) {
        return true;
      }
      return false;
    }

    const isDisabled = await page.evaluate((btn) => (btn as HTMLButtonElement).disabled, applyBtn);
    if (isDisabled) {
      if (await isApplicationSubmitted(page)) {
        return true;
      }
      return false;
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
    try {
      const cleanJobId = jobId ? jobId.trim().toLowerCase() : "";
      if (!cleanJobId || await isJobExisting(cleanJobId)) {
        console.log(`[Wellfound] Skipping ${cleanJobId}: Already exists in DB or empty.`);
        continue;
      }
      console.log(`[Wellfound] Navigating to apply for job ID: ${cleanJobId}`);

      const page = await resilientBrowser.newPage();
      const applicationLink = `${WELLFOUND_URL_JOB}${cleanJobId}`;
      await page.goto(applicationLink, { waitUntil: "load" });
      await delay(WAIT_TIME);

      const data = await extractData(page, jobId);
      await delay(WAIT_TIME);

      const { role, companyName, salary, experience, location, skills, about } = data;

      if (!companyName || !about) {
        console.log(`[Wellfound] Missing company name or description for job ID: ${cleanJobId}. Skipping.`);
        await delay(WAIT_TIME);
        await page.close();
        continue;
      }

      if (isBlacklistedCompany(companyName)) {
        console.log(`[Wellfound] Company ${companyName} is blacklisted for job ID: ${cleanJobId}. Skipping.`);
        await delay(WAIT_TIME);
        await page.close();
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
      await page.close();
    } catch (err) {
      console.error(`[Wellfound] Error processing job ID ${jobId}:`, err);
    }
  }
}