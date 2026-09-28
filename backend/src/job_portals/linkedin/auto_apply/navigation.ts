import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME_AUTO_APPLY } from "../../../utils/constants.ts";
export async function unfollowCompany(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const oldCheckbox = document.getElementById('follow-company-checkbox') as HTMLInputElement;
      if (oldCheckbox && oldCheckbox.checked) {
        const label = document.querySelector('label[for="follow-company-checkbox"]') as HTMLLabelElement;
        if (label) label.click();
        else oldCheckbox.click();
        return;
      }

      const divs = Array.from(document.querySelectorAll('div[role="checkbox"]'));
      const followDiv = divs.find(c => {
        const label = c.getAttribute('aria-label')?.toLowerCase() || '';
        return label.startsWith('follow ') && label.includes('stay up to date');
      });
      
      if (followDiv && followDiv.getAttribute('aria-checked') === 'true') {
        const label = followDiv.querySelector('label');
        if (label) label.click();
        else (followDiv as HTMLElement).click();
        return;
      }

      const allInputs = Array.from(document.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[];
      for (const input of allInputs) {
        if (input.checked) {
          let container = input.parentElement;
          let found = false;
          for (let i = 0; i < 5 && container; i++) {
            const text = container.textContent?.toLowerCase() || '';
            if (text.includes('follow') && text.includes('stay up to date')) {
              found = true;
              break;
            }
            container = container.parentElement;
          }
          if (found && container) {
            const label = container.querySelector('label');
            if (label) label.click();
            else input.click();
            return;
          }
        }
      }
    });
  } catch (error) {
  }
}
export async function clickNextOrSubmit(page: Page): Promise<{ success: boolean; isSubmit: boolean }> {
  try {
    const proceedBtnHandle = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const proceedBtn = btns.find(b => {
        const text = b.textContent?.trim()?.toLowerCase() || '';
        return text === 'next' || text === 'review' || text === 'submit application' || text === 'continue to next step' || text === 'review your application';
      });
      return proceedBtn || null;
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
