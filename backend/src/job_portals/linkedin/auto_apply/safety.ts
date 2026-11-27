import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME_AUTO_APPLY } from "../../../utils/constants.ts";
import { trackAndClosePopups } from "../../../utils/popupManager.ts";

/**
 * Checks if the "Job search safety reminder" modal is currently open.
 */
export async function isSafetyReminderModal(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();
      const allText = (document.body.innerText || '').toLowerCase();

      const hasTitle = (
        allText.includes('job search safety reminder') ||
        allText.includes('preapplysafetytipsmodal') ||
        document.querySelector('[data-sdui-screen*="PreApplySafetyTipsModal"]') !== null ||
        document.querySelector('dialog[open]') !== null
      );

      const hasContinueBtn = Array.from(document.querySelectorAll('a, button')).some(el => {
        const t = normalize(el.textContent || '');
        return t === 'continue applying' || t === 'continue apply' || t.includes('continue applying');
      });

      return hasTitle && hasContinueBtn;
    });
  } catch {
    return false;
  }
}

/**
 * Clicks the "Continue applying" button or link on the "Job search safety reminder" modal,
 * tracking and closing any external company site tab that gets opened.
 */
export async function handleSafetyReminderModal(page: Page): Promise<boolean> {
  try {
    const isPresent = await isSafetyReminderModal(page);
    if (!isPresent) return false;

    console.log("[LinkedIn AutoApply] Detected 'Job search safety reminder' modal. Clicking 'Continue applying'...");

    const popupRes = await trackAndClosePopups(page.browser(), page, async () => {
      await page.evaluate(() => {
        const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

        const candidates = Array.from(document.querySelectorAll<HTMLElement>('a, button, [role="button"]'));
        const continueBtn = candidates.find(el => {
          const text = normalize(el.textContent || '');
          const ariaLabel = normalize(el.getAttribute('aria-label') || '');
          return (
            text === 'continue applying' ||
            text === 'continue apply' ||
            text.includes('continue applying') ||
            ariaLabel.includes('continue applying')
          );
        });

        if (continueBtn) {
          if (continueBtn.tagName.toLowerCase() === 'a') {
            continueBtn.removeAttribute('target');
          }
          continueBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
          continueBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          continueBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          continueBtn.click();
        }
      });
    });

    if (popupRes.openedNewTab) {
      console.log(`[LinkedIn AutoApply] Safety reminder opened external site. Closed external tab: ${popupRes.finalUrl || 'new tab'}`);
    }

    await delay(WAIT_TIME_AUTO_APPLY);
    return true;
  } catch (error) {
    console.error("[LinkedIn AutoApply] Error handling safety reminder modal:", error);
    return false;
  }
}
