import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME_AUTO_APPLY } from "../../../utils/constants.ts";

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
 * Clicks the "Continue applying" button or link on the "Job search safety reminder" modal.
 */
export async function handleSafetyReminderModal(page: Page): Promise<boolean> {
  try {
    const isPresent = await isSafetyReminderModal(page);
    if (!isPresent) return false;

    console.log("[LinkedIn AutoApply] Detected 'Job search safety reminder' modal. Clicking 'Continue applying'...");

    const result = await page.evaluate(() => {
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
        // Prevent opening in new tab so everything stays within the active page
        if (continueBtn.tagName.toLowerCase() === 'a') {
          continueBtn.removeAttribute('target');
        }
        const href = continueBtn.getAttribute('href');

        continueBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        continueBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        continueBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        continueBtn.click();

        return { clicked: true, href };
      }

      return { clicked: false, href: null };
    });

    if (result.clicked) {
      await delay(WAIT_TIME_AUTO_APPLY);

      // Check if modal is still open; if so and an href is available, navigate directly
      const stillOpen = await isSafetyReminderModal(page);
      if (stillOpen && result.href && result.href.startsWith('http')) {
        try {
          console.log(`[LinkedIn AutoApply] Navigating directly to continue link: ${result.href}`);
          await page.goto(result.href, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await delay(WAIT_TIME_AUTO_APPLY);
        } catch (navErr) {
          console.warn("[LinkedIn AutoApply] Navigation error on continue applying link:", navErr);
        }
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error("[LinkedIn AutoApply] Error handling safety reminder modal:", error);
    return false;
  }
}
