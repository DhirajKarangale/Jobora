import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME_AUTO_APPLY } from "../../../utils/constants.ts";

import { handleResume } from "./resume.ts";
import { handleQuestions } from "./questions.ts";
import { unfollowCompany, clickNextOrSubmit } from "./navigation.ts";

export async function handleEasyApply(page: Page, jobId: string, targetResumeName: string = "DhirajKarangale.pdf"): Promise<boolean> {
  try {
    await page.waitForSelector('.jobs-apply-button, [aria-label="LinkedIn Apply to this job"]', { timeout: 10000 });
  } catch (e) {
    return false;
  }

  const easyApplyBtnHandle = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('.jobs-apply-button, [aria-label="LinkedIn Apply to this job"]'));
    return btns.find(b => (b as HTMLElement).offsetParent !== null) || btns[0] || null;
  });

  const easyApplyBtn = easyApplyBtnHandle.asElement() as import('puppeteer-core').ElementHandle<Element> | null;

  if (!easyApplyBtn) {
    return false;
  }

  const href = await easyApplyBtn.evaluate(b => b.getAttribute('href'));

  if (href && href.includes('apply')) {
    const fullUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
  } else {
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => { }),
      easyApplyBtn.evaluate(b => (b as HTMLElement).click())
    ]);
  }

  try {
    await page.waitForSelector('.jobs-easy-apply-modal, button[aria-label="Continue to next step"], button[aria-label="Submit application"]', { timeout: 15000 });
    await delay(1500);
  } catch (e) {
  }

  let previousFields = "";
  let stuckCounter = 0;

  for (let i = 0; i < 10; i++) {
    const currentFields = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('label, legend')).map(el => el.textContent?.trim()).join('|');
    });

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

    await handleResume(page, targetResumeName);
    await delay(WAIT_TIME_AUTO_APPLY);

    const allQuestionsHandled = await handleQuestions(page);
    await delay(WAIT_TIME_AUTO_APPLY);

    if (!allQuestionsHandled) {
      console.log(jobId);
      return false;
    }

    await unfollowCompany(page);
    await delay(WAIT_TIME_AUTO_APPLY);

    const { success, isSubmit } = await clickNextOrSubmit(page);

    if (!success) {
      console.log(jobId);
      return false;
    }

    if (isSubmit) return true;
  }

  console.log(jobId);
  return false;
}
