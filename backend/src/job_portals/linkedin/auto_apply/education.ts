import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME_AUTO_APPLY } from "../../../utils/constants.ts";
import { clickNextOrSubmit } from "./navigation.ts";

/**
 * Checks if the current modal step is the Education section.
 */
export async function isEducationStep(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

      // Check headings, labels, legends, or paragraphs for Education / Edit education
      const elements = Array.from(document.querySelectorAll('h1, h2, h3, h4, p, span, legend'));
      const hasHeader = elements.some(el => {
        const t = normalize(el.textContent || '');
        return t === 'education' || t === 'edit education';
      });
      if (hasHeader) return true;

      // Check for presence of delete education or add education button
      const buttons = Array.from(document.querySelectorAll('button'));
      const hasEduBtn = buttons.some(b => {
        const t = normalize(b.textContent || '');
        return t === 'delete education' || t.includes('delete education') ||
          t === 'add education' || t.includes('add education');
      });

      return hasEduBtn;
    });
  } catch {
    return false;
  }
}

/**
 * Checks if there are validation errors or open incomplete forms in the Education section.
 */
export async function hasEducationErrors(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const normalize = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

      const allText = (document.body.innerText || '').toLowerCase();
      const hasEducation = allText.includes('education') || allText.includes('edit education');
      if (!hasEducation) return false;

      // 1. Check if "Delete education" is visible (meaning an education form is expanded in edit mode)
      const buttons = Array.from(document.querySelectorAll('button'));
      const hasDeleteBtn = buttons.some(b => {
        const t = normalize(b.textContent || '');
        return (t === 'delete education' || t.includes('delete education')) &&
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
 * Removes the last education entry and confirms the "Remove" popup.
 */
export async function removeLastEducation(page: Page): Promise<boolean> {
  try {
    // 1. Check if a "Delete education" button is already visible
    let deleteClicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const delBtn = buttons.find(b => {
        const text = (b.textContent || '').trim().toLowerCase();
        return text === 'delete education' || text.includes('delete education');
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

    // 2. If no "Delete education" button was visible, click the Edit button (pencil icon) on the last education card
    if (!deleteClicked) {
      const editClicked = await page.evaluate(() => {
        // Look for buttons with aria-label starting with "Edit" or containing education, or pencil SVG
        let editButtons = Array.from(
          document.querySelectorAll<HTMLElement>(
            'button[aria-label*="Edit"][aria-label*="ducation"], button[aria-label*="Edit, Education"], button[aria-label^="Edit "]'
          )
        );

        // Fallback: look for buttons containing pencil SVG
        if (editButtons.length === 0) {
          editButtons = Array.from(document.querySelectorAll<HTMLElement>('button')).filter(b => {
            return b.querySelector('svg#pencil-outline-medium, svg[id*="pencil"]') !== null;
          });
        }

        if (editButtons.length === 0) return false;

        // Target the last education card
        const targetEditBtn = editButtons[editButtons.length - 1];
        targetEditBtn.scrollIntoView({ behavior: 'instant', block: 'center' });
        targetEditBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
        targetEditBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
        targetEditBtn.click();
        return true;
      });

      if (!editClicked) {
        console.log("[LinkedIn AutoApply] No education edit or delete button found.");
        return false;
      }

      // 3. Poll for "Delete education" button inside the newly expanded form
      for (let attempt = 0; attempt < 6; attempt++) {
        await delay(500);
        deleteClicked = await page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'));
          const delBtn = buttons.find(b => {
            const text = (b.textContent || '').trim().toLowerCase();
            return text === 'delete education' || text.includes('delete education');
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
        console.log("[LinkedIn AutoApply] Failed to click 'Delete education' after expanding.");
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
      console.log("[LinkedIn AutoApply] Successfully removed an education entry.");
      await delay(WAIT_TIME_AUTO_APPLY);
      return true;
    } else {
      console.log("[LinkedIn AutoApply] Remove confirmation button not found in popup.");
      return false;
    }
  } catch (error) {
    console.error("[LinkedIn AutoApply] Error removing education:", error);
    return false;
  }
}

/**
 * Handles education errors by repeatedly deleting education entries until errors are resolved.
 */
export async function handleEducationErrors(page: Page): Promise<{ success: boolean; isSubmit: boolean }> {
  const isEdu = await isEducationStep(page);
  if (!isEdu) {
    return { success: true, isSubmit: false };
  }

  let hasErrors = await hasEducationErrors(page);
  if (!hasErrors) {
    return { success: true, isSubmit: false };
  }

  console.log("[LinkedIn AutoApply] Detected errors in Education section. Resolving by removing problematic educations...");

  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const stillEdu = await isEducationStep(page);
    if (!stillEdu) {
      console.log("[LinkedIn AutoApply] Navigated away from Education step.");
      return { success: true, isSubmit: false };
    }

    hasErrors = await hasEducationErrors(page);
    if (!hasErrors) {
      console.log("[LinkedIn AutoApply] All Education errors resolved!");
      return { success: true, isSubmit: false };
    }

    const removed = await removeLastEducation(page);
    if (!removed) {
      console.log("[LinkedIn AutoApply] Could not remove any more education entries.");
      break;
    }

    // Try clicking Next or Submit again after removal
    await delay(WAIT_TIME_AUTO_APPLY);
    const { success, isSubmit } = await clickNextOrSubmit(page);
    if (isSubmit) {
      return { success: true, isSubmit: true };
    }

    await delay(WAIT_TIME_AUTO_APPLY);
    const stepAfterNext = await isEducationStep(page);
    const errorsAfterNext = await hasEducationErrors(page);

    if (!stepAfterNext || !errorsAfterNext) {
      console.log("[LinkedIn AutoApply] Education step advanced successfully after removal.");
      return { success: true, isSubmit: false };
    }
  }

  const finalHasErrors = await hasEducationErrors(page);
  return { success: !finalHasErrors, isSubmit: false };
}
