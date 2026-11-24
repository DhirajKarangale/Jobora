import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME_AUTO_APPLY } from "../../../utils/constants.ts";
import { clickNextOrSubmit } from "./navigation.ts";

/**
 * Checks if the current modal step is the Work Experience section.
 */
export async function isWorkExperienceStep(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

      // Check headings, labels, legends, or paragraphs for Work/Edit experience
      const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, span, legend'));
      const hasHeader = elements.some(el => {
        const t = normalize(el.textContent || '');
        return t === 'work experience' || t === 'edit experience';
      });
      if (hasHeader) return true;

      // Check for presence of edit buttons or delete experience button
      const hasEditBtn = document.querySelector(
        'button[aria-label*="Edit"][aria-label*="xperience"], button[aria-label*="Edit, Work Experience"]'
      ) !== null;

      const buttons = Array.from(document.querySelectorAll('button'));
      const hasDeleteBtn = buttons.some(b => {
        const t = normalize(b.textContent || '');
        return t === 'delete experience' || t.includes('delete experience');
      });

      return hasEditBtn || hasDeleteBtn;
    });
  } catch {
    return false;
  }
}

/**
 * Checks if there are validation errors or open incomplete forms in the Work Experience section.
 */
export async function hasWorkExperienceErrors(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

      const allText = (document.body.innerText || '').toLowerCase();
      const hasWorkExp = allText.includes('work experience') || allText.includes('edit experience');
      if (!hasWorkExp) return false;

      // 1. Check if "Delete experience" is visible (meaning an experience form is expanded in edit mode)
      const buttons = Array.from(document.querySelectorAll('button'));
      const hasDeleteBtn = buttons.some(b => {
        const t = normalize(b.textContent || '');
        return (t === 'delete experience' || t.includes('delete experience')) &&
          (b.offsetWidth > 0 || b.offsetHeight > 0 || b.getClientRects().length > 0);
      });

      // 2. Check for explicit error messages on the page
      const errorPhrases = [
        'this field is required',
        'please enter a valid',
        'select a valid',
        'please fix the errors',
        'enter a valid date',
        'check the highlighted fields'
      ];
      const hasErrorText = errorPhrases.some(phrase => allText.includes(phrase));

      // 3. Check for error elements or aria-invalid
      const errorElements = document.querySelectorAll(
        '.artdeco-inline-feedback--error, [aria-invalid="true"], [data-testid*="error"], .fb-dash-form-element--error'
      );
      const hasErrorEl = errorElements.length > 0;

      return hasErrorText || hasErrorEl || hasDeleteBtn;
    });
  } catch {
    return false;
  }
}

/**
 * Removes the last work experience entry and confirms the "Remove" popup.
 */
export async function removeLastExperience(page: Page): Promise<boolean> {
  try {
    // 1. Check if a "Delete experience" button is already visible
    let deleteClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const delBtn = buttons.find(b => {
        const text = (b.textContent || '').trim().toLowerCase();
        return text === 'delete experience' || text.includes('delete experience');
      });

      if (delBtn && (delBtn.offsetWidth > 0 || delBtn.offsetHeight > 0 || delBtn.getClientRects().length > 0)) {
        delBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        delBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        delBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        delBtn.click();
        return true;
      }
      return false;
    });

    // 2. If no "Delete experience" button was visible, click the Edit button (pencil icon) on the last experience card
    if (!deleteClicked) {
      const editClicked = await page.evaluate(() => {
        // Look for buttons with aria-label="Edit, Work Experience"
        let editButtons = Array.from(
          document.querySelectorAll<HTMLElement>(
            'button[aria-label*="Edit, Work Experience"], button[aria-label*="Edit, Work experience"], button[aria-label*="Edit work experience"], button[aria-label*="Edit"][aria-label*="xperience"]'
          )
        );

        // Fallback: look for buttons containing pencil SVG
        if (editButtons.length === 0) {
          editButtons = Array.from(document.querySelectorAll<HTMLElement>('button')).filter(b => {
            return b.querySelector('svg#pencil-outline-medium, svg[id*="pencil"]') !== null;
          });
        }

        if (editButtons.length === 0) return false;

        // Target the last experience card
        const targetEditBtn = editButtons[editButtons.length - 1];
        targetEditBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        targetEditBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        targetEditBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        targetEditBtn.click();
        return true;
      });

      if (!editClicked) {
        console.log("[LinkedIn AutoApply] No experience edit or delete button found.");
        return false;
      }

      // 3. Poll for "Delete experience" button inside the newly expanded form
      for (let attempt = 0; attempt < 6; attempt++) {
        await delay(500);
        deleteClicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const delBtn = buttons.find(b => {
            const text = (b.textContent || '').trim().toLowerCase();
            return text === 'delete experience' || text.includes('delete experience');
          });

          if (delBtn) {
            delBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
            delBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            delBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            delBtn.click();
            return true;
          }
          return false;
        });

        if (deleteClicked) break;
      }

      if (!deleteClicked) {
        console.log("[LinkedIn AutoApply] Failed to click 'Delete experience' after expanding.");
        return false;
      }
    }

    // 4. Poll for the "Remove" confirmation popup and click "Remove"
    let removeConfirmed = false;
    for (let attempt = 0; attempt < 8; attempt++) {
      await delay(500);
      removeConfirmed = await page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'));

        // Look for the "Remove" button in the "Remove from your application?" modal
        const removeBtn = buttons.find(b => {
          const text = (b.textContent || '').trim().toLowerCase();
          if (text !== 'remove') return false;

          const modal = b.closest('[role="dialog"], [role="alertdialog"], div');
          const modalText = (modal?.textContent || '').toLowerCase();
          return (
            modalText.includes('remove from your application') ||
            modalText.includes('this will not affect your linkedin profile') ||
            modalText.includes('remove')
          );
        }) || buttons.find(b => (b.textContent || '').trim().toLowerCase() === 'remove');

        if (removeBtn) {
          removeBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
          removeBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          removeBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          removeBtn.click();
          return true;
        }
        return false;
      });

      if (removeConfirmed) break;
    }

    if (removeConfirmed) {
      console.log("[LinkedIn AutoApply] Successfully removed an experience entry.");
      await delay(WAIT_TIME_AUTO_APPLY);
      return true;
    } else {
      console.log("[LinkedIn AutoApply] Remove confirmation button not found in popup.");
      return false;
    }
  } catch (error) {
    console.error("[LinkedIn AutoApply] Error removing experience:", error);
    return false;
  }
}

/**
 * Handles work experience errors by repeatedly deleting experience entries until errors are resolved.
 */
export async function handleWorkExperienceErrors(page: Page): Promise<{ success: boolean; isSubmit: boolean }> {
  const isWorkExp = await isWorkExperienceStep(page);
  if (!isWorkExp) {
    return { success: true, isSubmit: false };
  }

  let hasErrors = await hasWorkExperienceErrors(page);
  if (!hasErrors) {
    return { success: true, isSubmit: false };
  }

  console.log("[LinkedIn AutoApply] Detected errors in Work Experience section. Resolving by removing problematic experiences...");

  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const stillWorkExp = await isWorkExperienceStep(page);
    if (!stillWorkExp) {
      console.log("[LinkedIn AutoApply] Navigated away from Work Experience step.");
      return { success: true, isSubmit: false };
    }

    hasErrors = await hasWorkExperienceErrors(page);
    if (!hasErrors) {
      console.log("[LinkedIn AutoApply] All Work Experience errors resolved!");
      return { success: true, isSubmit: false };
    }

    const removed = await removeLastExperience(page);
    if (!removed) {
      console.log("[LinkedIn AutoApply] Could not remove any more experience entries.");
      break;
    }

    // Try clicking Next or Submit again after removal
    await delay(WAIT_TIME_AUTO_APPLY);
    const { success, isSubmit } = await clickNextOrSubmit(page);
    if (isSubmit) {
      return { success: true, isSubmit: true };
    }

    await delay(WAIT_TIME_AUTO_APPLY);
    const stepAfterNext = await isWorkExperienceStep(page);
    const errorsAfterNext = await hasWorkExperienceErrors(page);

    if (!stepAfterNext || !errorsAfterNext) {
      console.log("[LinkedIn AutoApply] Work experience step advanced successfully after removal.");
      return { success: true, isSubmit: false };
    }
  }

  const finalHasErrors = await hasWorkExperienceErrors(page);
  return { success: !finalHasErrors, isSubmit: false };
}
