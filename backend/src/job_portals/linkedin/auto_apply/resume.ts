import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME_AUTO_APPLY } from "../../../utils/constants.ts";
export async function handleResume(page: Page, targetResumeName: string = "DhirajKarangale.pdf"): Promise<boolean> {
  const resumeContainers = await page.$$('.jobs-document-upload-redesign-card__container');
  if (resumeContainers.length === 0) return false;
  try {
    const showMoreBtn = await page.$('.jobs-document-upload__show-more-less-button');
    if (showMoreBtn) {
      const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label') || '', showMoreBtn);
      if (ariaLabel.toLowerCase().includes('show') && ariaLabel.toLowerCase().includes('more resumes')) {
        await showMoreBtn.click();
        await delay(WAIT_TIME_AUTO_APPLY);
      }
    }
  } catch (error) {
  }
  const isSelected = await page.evaluate((targetName) => {
    const containers = Array.from(document.querySelectorAll('.jobs-document-upload-redesign-card__container'));
    for (const container of containers) {
      const fileNameEl = container.querySelector('.jobs-document-upload-redesign-card__file-name');
      if (fileNameEl) {
        const text = fileNameEl.textContent?.trim().toLowerCase() || '';
        const target = targetName.toLowerCase();
        const targetNoExt = target.replace(/\.pdf$/, '').replace(/\.docx$/, '');
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
    return false;
  }, targetResumeName);
  return isSelected;
}
