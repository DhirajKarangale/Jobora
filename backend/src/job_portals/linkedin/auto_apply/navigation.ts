import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME_AUTO_APPLY } from "../../../utils/constants.ts";
export async function unfollowCompany(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const checkbox = document.getElementById('follow-company-checkbox') as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        const label = document.querySelector('label[for="follow-company-checkbox"]') as HTMLLabelElement;
        if (label) label.click();
        else checkbox.click();
      }
    });
  } catch (error) {
  }
}
export async function clickNextOrSubmit(page: Page): Promise<{ success: boolean; isSubmit: boolean }> {
  try {
    const proceedBtnHandle = await page.evaluateHandle(() => {
      const nextBtn = document.querySelector('button[aria-label="Continue to next step"]');
      const reviewBtn = document.querySelector('button[aria-label="Review your application"]');
      const submitBtn = document.querySelector('button[aria-label="Submit application"]');
      return nextBtn || reviewBtn || submitBtn || null;
    });
    const proceedBtn = proceedBtnHandle.asElement() as import('puppeteer-core').ElementHandle<Element> | null;
    if (proceedBtn) {
      const label = await proceedBtn.evaluate(b => b.getAttribute('aria-label') || b.textContent?.trim() || '');
      await proceedBtn.click();
      await delay(WAIT_TIME_AUTO_APPLY);
      if (label.toLowerCase().includes("submit")) {
        return { success: true, isSubmit: true };
      }
      return { success: true, isSubmit: false };
    }
    return { success: false, isSubmit: false };
  } catch (error) {
    return { success: false, isSubmit: false };
  }
}
