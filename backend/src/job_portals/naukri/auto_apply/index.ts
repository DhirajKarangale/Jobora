import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME_AUTO_APPLY, WAIT_TIME } from "../../../utils/constants.ts";
import { handleNaukriQuestions } from "./questions.ts";

export async function handleNaukriApply(page: Page, jobId: string): Promise<boolean> {
  try {
    await page.goto(`https://www.naukri.com/job-listings-${jobId}`, { waitUntil: "domcontentloaded" });
    await delay(WAIT_TIME); 

    let applyBtn = null;
    try {
        applyBtn = await page.waitForSelector('#apply-button', { timeout: 8000 });
    } catch (e) {}

    if (!applyBtn) {
      console.log(`[Naukri] #apply-button not found within timeout.`);
      const btnText = await page.evaluate(() => {
          const btn = document.querySelector('.apply-button');
          return btn ? btn.textContent?.trim().toLowerCase() : '';
      });
      if (btnText === 'already applied' || btnText === 'applied') {
          return true;
      }
      return false;
    }

    const btnText = await page.evaluate(el => el.textContent?.trim().toLowerCase() || '', applyBtn);
    if (btnText.includes('company site')) {
      console.log(`Job ${jobId} requires applying on company site. Skipping.`);
      return false;
    }

    console.log(`[Naukri] Clicking Apply button for job ${jobId}...`);
    await page.evaluate(el => (el as HTMLElement).click(), applyBtn);
    await delay(WAIT_TIME_AUTO_APPLY);

    for (let i = 0; i < 20; i++) {
        const isChatbotVisible = await page.evaluate(() => {
            const drawer = document.querySelector('.chatbot_DrawerContentWrapper');
            return drawer && window.getComputedStyle(drawer).display !== 'none';
        });

        if (isChatbotVisible) {
            const success = await handleNaukriQuestions(page);
            if (!success) return false;
            await delay(WAIT_TIME_AUTO_APPLY);
            break;
        }

        const isApplied = await page.evaluate(() => {
            const btn = document.querySelector('#apply-button');
            const text = btn ? btn.textContent?.trim().toLowerCase() : '';
            if (text === 'already applied' || text === 'applied') return true;
            
            const toast = document.querySelector('.toast-msg');
            if (toast && toast.textContent?.toLowerCase().includes('successfully')) return true;

            return false;
        });

        if (isApplied) {
            return true;
        }

        await delay(WAIT_TIME_AUTO_APPLY);
    }

    const finalCheck = await page.evaluate(() => {
        const btn = document.querySelector('#apply-button');
        const text = btn ? btn.textContent?.trim().toLowerCase() : '';
        return text === 'already applied' || text === 'applied';
    });

    return finalCheck;

  } catch (error) {
    console.error(`Failed to apply for Naukri job ${jobId}:`, error);
    return false;
  }
}
