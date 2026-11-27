import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME_AUTO_APPLY } from "../../../utils/constants.ts";

import { handleResume } from "./resume.ts";
import { handleQuestions } from "./questions.ts";
import { unfollowCompany, clickNextOrSubmit, isStepReadyToProceed } from "./navigation.ts";
import { isWorkExperienceStep, hasWorkExperienceErrors, handleWorkExperienceErrors } from "./experience.ts";
import { isEducationStep, hasEducationErrors, handleEducationErrors } from "./education.ts";
import { handleSafetyReminderModal } from "./safety.ts";
import { trackAndClosePopups } from "../../../utils/popupManager.ts";

export async function handleEasyApply(page: Page, jobId: string, targetResumeName: string = "DhirajKarangale.pdf"): Promise<boolean> {
  // Ensure esbuild/tsx __name helper is always defined in the page context
  try {
    await page.evaluateOnNewDocument(() => {
      if (typeof (window as any).__name === "undefined") {
        (window as any).__name = (target: any) => target;
      }
    });
    await page.evaluate(() => {
      if (typeof (window as any).__name === "undefined") {
        (window as any).__name = (target: any) => target;
      }
    });
  } catch {}

  // If safety reminder modal is already showing, click Continue applying
  await handleSafetyReminderModal(page);

  try {
    await page.waitForSelector(
      '.jobs-apply-button, [aria-label="LinkedIn Apply to this job"], [aria-label="Easy Apply to this job"], [data-sdui-screen*="PreApplySafetyTipsModal"], dialog[open]',
      { timeout: 10000 }
    );
  } catch (e) {
    if (await handleSafetyReminderModal(page)) {
      await delay(WAIT_TIME_AUTO_APPLY);
    } else {
      return false;
    }
  }

  await handleSafetyReminderModal(page);

  const easyApplyBtnHandle = await page.evaluateHandle(() => {
    // Check if safety modal continue button is present first
    const continueBtn = Array.from(document.querySelectorAll('a, button')).find(el => {
      const text = (el.textContent || '').trim().toLowerCase();
      return text === 'continue applying' || text === 'continue apply' || text.includes('continue applying');
    });
    if (continueBtn && (continueBtn as HTMLElement).offsetParent !== null) return continueBtn;

    const btns = Array.from(document.querySelectorAll('.jobs-apply-button, [aria-label="LinkedIn Apply to this job"], [aria-label="Easy Apply to this job"]'));
    return btns.find(b => (b as HTMLElement).offsetParent !== null) || btns[0] || null;
  });

  const easyApplyBtn = easyApplyBtnHandle.asElement() as import('puppeteer-core').ElementHandle<Element> | null;

  if (!easyApplyBtn) {
    return false;
  }

  const isExternal = await easyApplyBtn.evaluate(b => {
    const text = (b.textContent || '').toLowerCase();
    const href = b.getAttribute('href') || '';
    const ariaLabel = (b.getAttribute('aria-label') || '').toLowerCase();
    const target = b.getAttribute('target');

    // "Continue applying" on safety modal should not be skipped as external
    if (text.includes('continue applying') || text.includes('continue apply')) {
      return false;
    }

    return (
      target === '_blank' ||
      href.includes('/safety/go/') ||
      text.includes('company website') ||
      text.includes('company site') ||
      text.includes('off linkedin') ||
      ariaLabel.includes('company website')
    );
  });

  if (isExternal) {
    console.log(`[LinkedIn AutoApply] Job ${jobId} requires applying on company website. Skipping Easy Apply.`);
    return false;
  }

  const href = await easyApplyBtn.evaluate(b => b.getAttribute('href'));

  if (href && href.includes('apply')) {
    const fullUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
    try {
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
    } catch (navErr: any) {
      console.warn(`[LinkedIn AutoApply] Navigation error for job ${jobId}:`, navErr.message);
      return false;
    }
  } else {
    const popupRes = await trackAndClosePopups(page.browser(), page, async () => {
      await easyApplyBtn.evaluate(b => {
        if (b.tagName.toLowerCase() === 'a') b.removeAttribute('target');
        (b as HTMLElement).click();
      });
    });

    if (popupRes.openedNewTab) {
      console.log(`[LinkedIn AutoApply] Job ${jobId} requires applying on company website. Closed external tab.`);
      return false;
    }
  }

  await delay(1000);
  await handleSafetyReminderModal(page);

  try {
    await page.waitForSelector('.jobs-easy-apply-modal, [role="dialog"], dialog[open]', { timeout: 15000 });
    await delay(WAIT_TIME_AUTO_APPLY);
  } catch (e) {
  }

  await handleSafetyReminderModal(page);

  let previousFields = "";
  let stuckCounter = 0;

  for (let i = 0; i < 10; i++) {
    if (page.isClosed()) return false;

    // Check for safety reminder modal on each iteration
    if (await handleSafetyReminderModal(page)) {
      stuckCounter = 0;
      await delay(WAIT_TIME_AUTO_APPLY);
    }

    let currentFields = "";
    try {
      currentFields = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea, label, legend')).map(el => (el as any).name || el.id || el.textContent?.trim() || '').join('|');
      });
    } catch (err: any) {
      if (err?.message?.includes("detached") || err?.message?.includes("Target closed")) {
        console.warn(`[LinkedIn AutoApply] Target or frame unavailable during evaluation for job ${jobId}:`, err.message);
        return false;
      }
      throw err;
    }

    if (currentFields && currentFields === previousFields) {
      stuckCounter++;
      if (stuckCounter >= 2) {
        console.log(`Stuck on the same page. Unable to apply for ${jobId}`);
        return false;
      }
    } else {
      stuckCounter = 0;
    }
    previousFields = currentFields;

    // 1. Resume
    await handleResume(page, targetResumeName);
    await delay(WAIT_TIME_AUTO_APPLY);

    // 2. Pre-check for work experience errors if form is already expanded with missing fields
    if (await isWorkExperienceStep(page) && await hasWorkExperienceErrors(page)) {
      console.log(`[LinkedIn AutoApply] Detected open/invalid Work Experience form. Resolving...`);
      const expRes = await handleWorkExperienceErrors(page);
      if (expRes.isSubmit) return true;
      stuckCounter = 0;
    }

    // Pre-check for education errors if form is already expanded with missing fields
    if (await isEducationStep(page) && await hasEducationErrors(page)) {
      console.log(`[LinkedIn AutoApply] Detected open/invalid Education form. Resolving...`);
      const eduRes = await handleEducationErrors(page);
      if (eduRes.isSubmit) return true;
      stuckCounter = 0;
    }

    // 3. User requirement: "if something is auto filled, hit next if gives error then only edit it"
    const stepStatus = await isStepReadyToProceed(page);
    if (stepStatus.ready) {
      console.log(`[LinkedIn AutoApply] Step fields appear auto-filled. Attempting Next...`);
      await unfollowCompany(page);
      const nextRes = await clickNextOrSubmit(page);
      if (nextRes.isSubmit) return true;

      // Verify if the step advanced
      await delay(WAIT_TIME_AUTO_APPLY);
      const newFields = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input, select, textarea, label, legend')).map(el => (el as any).name || el.id || el.textContent?.trim() || '').join('|');
      }).catch(() => "");

      if (newFields && newFields !== currentFields) {
        console.log(`[LinkedIn AutoApply] Step advanced successfully using auto-filled data.`);
        continue;
      }
      console.log(`[LinkedIn AutoApply] Step did not advance; resolving any errors or unanswered fields...`);
    }

    // 4. Questions
    const allQuestionsHandled = await handleQuestions(page);
    await delay(WAIT_TIME_AUTO_APPLY);

    if (!allQuestionsHandled) {
      // Check if questions failed due to Work Experience validation errors
      if (await isWorkExperienceStep(page)) {
        console.log(`[LinkedIn AutoApply] Questions check failed on Work Experience step. Attempting to resolve by deleting invalid experience...`);
        const expRes = await handleWorkExperienceErrors(page);
        if (expRes.isSubmit) return true;
        if (!expRes.success) {
          console.log(`[LinkedIn AutoApply] Failed to resolve Work Experience errors for job ${jobId}`);
          return false;
        }
        stuckCounter = 0;
      }
      // Check if questions failed due to Education validation errors
      else if (await isEducationStep(page)) {
        console.log(`[LinkedIn AutoApply] Questions check failed on Education step. Attempting to resolve by deleting invalid education...`);
        const eduRes = await handleEducationErrors(page);
        if (eduRes.isSubmit) return true;
        if (!eduRes.success) {
          console.log(`[LinkedIn AutoApply] Failed to resolve Education errors for job ${jobId}`);
          return false;
        }
        stuckCounter = 0;
      } else {
        console.log(`[LinkedIn AutoApply] Failed to answer all questions for job ${jobId}`);
        return false;
      }
    }

    // 4. Unfollow company
    await unfollowCompany(page);
    await delay(WAIT_TIME_AUTO_APPLY);

    // 5. Click Next or Submit
    const { success, isSubmit } = await clickNextOrSubmit(page);

    if (!success) {
      // If click Next or Submit failed, check if we are stuck on Work Experience or Education errors
      if (await isWorkExperienceStep(page)) {
        console.log(`[LinkedIn AutoApply] Could not proceed on Work Experience step. Resolving errors...`);
        const expRes = await handleWorkExperienceErrors(page);
        if (expRes.isSubmit) return true;
        if (!expRes.success) {
          console.log(`[LinkedIn AutoApply] Failed to click Next or Submit for job ${jobId}`);
          return false;
        }
        stuckCounter = 0;
      } else if (await isEducationStep(page)) {
        console.log(`[LinkedIn AutoApply] Could not proceed on Education step. Resolving errors...`);
        const eduRes = await handleEducationErrors(page);
        if (eduRes.isSubmit) return true;
        if (!eduRes.success) {
          console.log(`[LinkedIn AutoApply] Failed to click Next or Submit for job ${jobId}`);
          return false;
        }
        stuckCounter = 0;
      } else {
        console.log(`[LinkedIn AutoApply] Failed to click Next or Submit for job ${jobId}`);
        return false;
      }
    }

    if (isSubmit) return true;

    // 6. Post-check: If Next was clicked but form stayed on Work Experience or Education due to errors
    await delay(WAIT_TIME_AUTO_APPLY);

    if (await isWorkExperienceStep(page) && await hasWorkExperienceErrors(page)) {
      console.log(`[LinkedIn AutoApply] Work Experience validation blocked proceeding after Next. Resolving...`);
      const expRes = await handleWorkExperienceErrors(page);
      if (expRes.isSubmit) return true;
      if (!expRes.success) {
        console.log(`[LinkedIn AutoApply] Could not resolve Work Experience errors for job ${jobId}`);
        return false;
      }
      stuckCounter = 0;
    }

    if (await isEducationStep(page) && await hasEducationErrors(page)) {
      console.log(`[LinkedIn AutoApply] Education validation blocked proceeding after Next. Resolving...`);
      const eduRes = await handleEducationErrors(page);
      if (eduRes.isSubmit) return true;
      if (!eduRes.success) {
        console.log(`[LinkedIn AutoApply] Could not resolve Education errors for job ${jobId}`);
        return false;
      }
      stuckCounter = 0;
    }
  }

  console.log(`[LinkedIn AutoApply] Exceeded maximum pagination steps (stuck) for job ${jobId}`);
  return false;
}
