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
      const btns = Array.from(document.querySelectorAll('button, a'));
      const proceedBtn = btns.find(b => {
        const text = b.textContent?.trim()?.toLowerCase() || '';
        return (
          text === 'next' ||
          text === 'review' ||
          text === 'submit application' ||
          text === 'continue to next step' ||
          text === 'review your application' ||
          text === 'continue applying' ||
          text === 'continue apply'
        );
      });
      return proceedBtn || null;
    });
    const proceedBtn = proceedBtnHandle.asElement() as import('puppeteer-core').ElementHandle<Element> | null;
    if (proceedBtn) {
      const label = await proceedBtn.evaluate(b => b.getAttribute('aria-label') || b.textContent?.trim() || '');
      await proceedBtn.evaluate(b => {
        if (b.tagName.toLowerCase() === 'a') b.removeAttribute('target');
      });
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

export async function isStepReadyToProceed(page: Page): Promise<{ ready: boolean; hasErrors: boolean }> {
  try {
    return await page.evaluate(() => {
      // 1. Any visible validation errors or invalid fields
      const errorEls = Array.from(document.querySelectorAll(
        '.artdeco-inline-feedback--error, [aria-invalid="true"], .fb-dash-form-element--error, [data-test-form-element-error]'
      ));
      const hasErrors = errorEls.some(el => (el.textContent || '').trim().length > 0 || el.getAttribute('aria-invalid') === 'true');
      if (hasErrors) return { ready: false, hasErrors: true };

      // 2. Any required text/number/email/tel inputs that are empty
      const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
        'input:not([type="hidden"]), textarea'
      ));

      for (const input of inputs) {
        if (input.type === 'radio' || input.type === 'checkbox') continue;

        const labelText = (
          input.getAttribute('aria-label') ||
          input.closest('label')?.textContent ||
          input.closest('.fb-dash-form-element, .jobs-easy-apply-form-element')?.textContent ||
          ''
        );

        const isReq = (
          input.required ||
          input.getAttribute('aria-required') === 'true' ||
          labelText.includes('*') ||
          labelText.toLowerCase().includes('required')
        );

        if (isReq && !input.value?.trim()) {
          return { ready: false, hasErrors: false };
        }
      }

      // 3. Any required select elements without a valid choice
      const selects = Array.from(document.querySelectorAll<HTMLSelectElement>('select'));
      for (const sel of selects) {
        const labelText = (
          sel.getAttribute('aria-label') ||
          sel.closest('label')?.textContent ||
          sel.closest('.fb-dash-form-element, .jobs-easy-apply-form-element')?.textContent ||
          ''
        );
        const isReq = (
          sel.required ||
          sel.getAttribute('aria-required') === 'true' ||
          labelText.includes('*') ||
          labelText.toLowerCase().includes('required')
        );
        if (isReq) {
          const val = sel.value?.trim().toLowerCase() || '';
          const txt = sel.options[sel.selectedIndex]?.text.trim().toLowerCase() || '';
          if (!val || val === 'select an option' || val === 'select' || txt === 'select an option' || txt === 'select') {
            return { ready: false, hasErrors: false };
          }
        }
      }

      // 4. Any required fieldsets or radio groups with no option selected
      const fieldsets = Array.from(document.querySelectorAll('fieldset, [role="radiogroup"]'));
      for (const fs of fieldsets) {
        const text = fs.textContent || '';
        const isReq = (
          fs.getAttribute('aria-required') === 'true' ||
          fs.querySelector('legend')?.textContent?.includes('*') ||
          text.includes('*') ||
          text.toLowerCase().includes('required')
        );
        if (isReq) {
          const checked = fs.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
          if (!checked) return { ready: false, hasErrors: false };
        }
      }

      return { ready: true, hasErrors: false };
    });
  } catch (e) {
    return { ready: false, hasErrors: false };
  }
}

