import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME_AUTO_APPLY } from "../../../utils/constants.ts";
export async function handleResume(page: Page, targetResumeName: string = "DhirajKarangale.pdf"): Promise<boolean> {
  try {
    const showMoreBtn = await page.$('.jobs-document-upload__show-more-less-button');
    if (showMoreBtn) {
      const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label') || '', showMoreBtn);
      if (ariaLabel.toLowerCase().includes('show') && ariaLabel.toLowerCase().includes('more resumes')) {
        await showMoreBtn.click();
        await delay(WAIT_TIME_AUTO_APPLY);
      }
    }

    const genericShowMore = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find(b => b.textContent?.toLowerCase().includes('show more resumes')) || null;
    });
    const genericShowMoreEl = genericShowMore.asElement() as import('puppeteer-core').ElementHandle<Element> | null;
    if (genericShowMoreEl) {
      await genericShowMoreEl.click();
      await delay(WAIT_TIME_AUTO_APPLY);
    }
  } catch (error) {
  }

  const isSelected = await page.evaluate((targetName) => {
    const target = targetName.toLowerCase();
    const targetNoExt = target.replace(/\.pdf$/, '').replace(/\.docx$/, '');

    // Old UI approach
    const containers = Array.from(document.querySelectorAll('.jobs-document-upload-redesign-card__container'));
    for (const container of containers) {
      const fileNameEl = container.querySelector('.jobs-document-upload-redesign-card__file-name');
      if (fileNameEl) {
        const text = fileNameEl.textContent?.trim().toLowerCase() || '';
        if (text === target || text.includes(targetNoExt)) {
          const input = container.querySelector('input') as HTMLInputElement;
          if (input && input.checked) return true;
          const label = container.querySelector('label.jobs-document-upload-redesign-card__toggle-label') as HTMLLabelElement;
          if (label) {
            label.click();
            return true;
          }
          (container as HTMLElement).click();
          return true;
        }
      }
    }

    // New UI approach using div[role="radio"]
    const radios = Array.from(document.querySelectorAll('div[role="radio"]'));
    
    // First pass: look for an exact match to avoid matching "DhirajKarangale_Java.pdf" when looking for "DhirajKarangale.pdf"
    for (const radio of radios) {
      const ariaLabel = radio.getAttribute('aria-label')?.toLowerCase() || '';
      const textContent = radio.textContent?.toLowerCase() || '';
      
      if (ariaLabel === target || textContent === target || ariaLabel === targetNoExt || textContent === targetNoExt) {
        if (radio.getAttribute('aria-checked') === 'true') return true;
        
        const label = radio.querySelector('label');
        if (label) label.click();
        else (radio as HTMLElement).click();
        return true;
      }
    }

    // Second pass: fallback to partial match
    for (const radio of radios) {
      const ariaLabel = radio.getAttribute('aria-label')?.toLowerCase() || '';
      const textContent = radio.textContent?.toLowerCase() || '';
      
      if (ariaLabel.includes(targetNoExt) || textContent.includes(targetNoExt)) {
        if (radio.getAttribute('aria-checked') === 'true') return true;
        
        const label = radio.querySelector('label');
        if (label) label.click();
        else (radio as HTMLElement).click();
        return true;
      }
    }

    return false;
  }, targetResumeName);

  return isSelected;
}
