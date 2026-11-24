import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import answersConfig from "../../../utils/auto_apply_answers.json" with { type: "json" };
import { WAIT_TIME_AUTO_APPLY } from "../../../utils/constants.ts";

function resolveDynamicValue(value: string | undefined): string {
  if (!value) return '';
  if (value === 'DYNAMIC_DATE_30_DAYS') {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${mm}/${dd}/${yyyy}`;
  }
  return value;
}

export async function handleTypeaheadSelection(
  page: Page,
  field: import('puppeteer-core').ElementHandle<Element>,
  searchTerm: string
): Promise<boolean> {
  // Wait for dropdown menu / suggestions to render
  await delay(1000);

  // Base term to match (e.g. "pune" from "Pune" or "Pune City, Maharashtra, India")
  const baseTerm = searchTerm.split(/[,/]/)[0].trim().toLowerCase();

  const selected = await page.evaluate((term) => {
    const q = term.toLowerCase().trim();

    // Strategy 1: Standard option selectors
    const standardSelectors = [
      '[role="option"]',
      '.artdeco-typeahead__result',
      '.basic-typeahead__selectable',
      '[data-test-search-result]',
      '.jobs-easy-apply-form-element__search-result',
      'li[data-test-typeahead-result]'
    ];
    const stdOptions = Array.from(document.querySelectorAll<HTMLElement>(standardSelectors.join(', ')));
    for (const opt of stdOptions) {
      const text = (opt.textContent || '').toLowerCase().trim();
      if (text.includes(q)) {
        opt.click();
        return true;
      }
    }
    if (stdOptions.length > 0) {
      stdOptions[0].click();
      return true;
    }

    // Strategy 2: Floating dropdown / listbox containers (including SDUI)
    const popupContainers = Array.from(document.querySelectorAll<HTMLElement>(
      '[role="listbox"], .artdeco-typeahead__results-list, div[data-testid*="typeahead"], div[data-testid*="dropdown"], div[data-testid*="menu"], dialog, [data-testid="dialog"]'
    ));
    for (const container of popupContainers) {
      const items = Array.from(container.querySelectorAll<HTMLElement>('div, li, p, span, button'));
      for (const item of items) {
        const text = (item.textContent || '').toLowerCase().trim();
        if (text.includes(q) && item.children.length === 0 && item.offsetParent !== null) {
          const clickable = item.closest('li, button, [role="option"]') || item;
          (clickable as HTMLElement).click();
          return true;
        }
      }
    }

    // Strategy 3: Any visible element on screen containing the location name (e.g. "Pune District, Maharashtra, India")
    const allElements = Array.from(document.querySelectorAll<HTMLElement>('div, li, p, span'));
    for (const el of allElements) {
      if (el.children.length <= 1 && el.offsetParent !== null && el.tagName.toLowerCase() !== 'input') {
        const text = (el.textContent || '').toLowerCase().trim();
        if (
          text.includes(q) &&
          (text.includes('maharashtra') || text.includes('india') || text.includes('area') || text.includes('district') || text.includes('city') || text.includes('division'))
        ) {
          if (!el.closest('label') && !el.closest('h1') && !el.closest('h2') && !el.closest('legend') && !el.closest('header')) {
            el.click();
            return true;
          }
        }
      }
    }

    return false;
  }, baseTerm);

  if (selected) {
    await delay(500);
    return true;
  }

  // Original fallback: ArrowDown to highlight first suggestion, then Enter to select
  try {
    await field.press('ArrowDown');
    await delay(300);
    await field.press('Enter');
    await delay(500);
  } catch (err) {
  }

  return false;
}

export async function handleQuestions(page: Page): Promise<boolean> {
  try {
    const formFields = await page.$$(
      'fieldset, div[role="radiogroup"], [data-testid*="radio-group"], select, textarea, input:not([type="hidden"])'
    );

    for (const field of formFields) {
      // 1. Inspect control status and extract question text in a single evaluated pass
      const info = await page.evaluate(el => {
        const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
        const tagName = el.tagName.toLowerCase();
        const role = el.getAttribute('role') || '';
        const isFieldsetOrGroup = tagName === 'fieldset' || role === 'radiogroup' || el.hasAttribute('data-test-checkbox-form-component');

        // Check if field is already filled or selected
        let alreadyFilled = false;
        let currentValue = '';

        if (isFieldsetOrGroup) {
          const checked = el.querySelectorAll<HTMLInputElement>('input[type="radio"]:checked, input[type="checkbox"]:checked');
          alreadyFilled = checked.length > 0;
          if (alreadyFilled) currentValue = `${checked.length} option(s) checked`;
        } else if (tagName === 'select') {
          const sel = el as HTMLSelectElement;
          if (sel.selectedIndex >= 0 && sel.options[sel.selectedIndex]) {
            const optText = sel.options[sel.selectedIndex].text.trim().toLowerCase();
            const optVal = sel.value.trim().toLowerCase();
            alreadyFilled = (
              optText !== '' &&
              optVal !== '' &&
              optText !== 'select an option' &&
              optText !== 'select' &&
              optText !== 'choose an option'
            );
            currentValue = sel.options[sel.selectedIndex].text.trim();
          }
        } else if (tagName === 'input' || tagName === 'textarea') {
          if (el instanceof HTMLInputElement && (el.type === 'radio' || el.type === 'checkbox')) {
            alreadyFilled = el.checked;
            currentValue = el.checked ? 'checked' : '';
          } else {
            const input = el as HTMLInputElement | HTMLTextAreaElement;
            currentValue = input.value?.trim() || '';
            alreadyFilled = currentValue.length > 0;
          }
        }

        // Extract question text strictly scoped to THIS field's immediate container
        const texts: string[] = [];

        const ariaLabel = el.getAttribute('aria-label');
        if (ariaLabel) texts.push(ariaLabel);

        const ariaLabelledby = el.getAttribute('aria-labelledby');
        if (ariaLabelledby) {
          for (const id of ariaLabelledby.split(/\s+/)) {
            const target = document.getElementById(id);
            if (target?.textContent) texts.push(target.textContent);
          }
        }

        if (el.id) {
          const labelFor = document.querySelector(`label[for="${el.id}"]`);
          if (labelFor?.textContent) texts.push(labelFor.textContent);
        }

        const parentLabel = el.closest('label');
        if (parentLabel?.textContent) texts.push(parentLabel.textContent);

        if (tagName === 'fieldset') {
          const legend = el.querySelector('legend');
          if (legend?.textContent) texts.push(legend.textContent);
        }

        // Ascend to the single question container; stop before containers with multiple inputs or dialog root
        let curr: HTMLElement | null = el.parentElement;
        while (curr) {
          const isStopBoundary = (
            curr.tagName.toLowerCase() === 'form' ||
            curr.getAttribute('role') === 'dialog' ||
            curr.getAttribute('data-testid') === 'dialog-content' ||
            curr.getAttribute('data-testid') === 'lazy-column' ||
            curr.classList.contains('jobs-easy-apply-modal')
          );
          if (isStopBoundary) break;

          const controlsInside = curr.querySelectorAll('input:not([type="hidden"]), select, textarea');
          if (controlsInside.length > 1 && !isFieldsetOrGroup) {
            break;
          }

          const items = Array.from(curr.querySelectorAll<HTMLElement>('p, span, label, legend, h2, h3, h4'));
          for (const item of items) {
            const t = normalize(item.textContent || '');
            if (
              t.length > 2 &&
              !t.includes('characters') &&
              !/^\d+\/\d+/.test(t) &&
              !texts.some(existing => existing.includes(t))
            ) {
              texts.push(t);
            }
          }

          if (
            curr.classList.contains('fb-dash-form-element') ||
            curr.classList.contains('jobs-easy-apply-form-element') ||
            curr.getAttribute('componentkey')?.includes('easyApplyFieldFocus')
          ) {
            break;
          }

          curr = curr.parentElement;
        }

        const inputEl = el as HTMLInputElement;
        const isRequired = (
          inputEl.required ||
          inputEl.getAttribute('aria-required') === 'true' ||
          texts.some(t => t.includes('*') || t.includes('required'))
        );

        // Check if THIS field currently has an error
        let hasError = false;
        if (
          el.getAttribute('aria-invalid') === 'true' ||
          el.classList.contains('artdeco-inline-feedback--error') ||
          el.classList.contains('error')
        ) {
          hasError = true;
        }

        if (!hasError && el.id) {
          const errEl = document.getElementById(`${el.id}-error`);
          if (errEl && (errEl.textContent || '').trim().length > 0) {
            hasError = true;
          }
        }

        if (!hasError) {
          const container = el.closest(
            '.fb-dash-form-element, .jobs-easy-apply-form-element, [data-test-form-element], .artdeco-text-input--error'
          );
          if (container) {
            const errorFeedback = container.querySelector(
              '.artdeco-inline-feedback--error, [data-test-form-element-error]'
            );
            if (errorFeedback && (errorFeedback.textContent || '').trim().length > 0) {
              hasError = true;
            }
          }
        }

        return {
          tagName,
          type: inputEl.type || '',
          id: el.id || '',
          isCombobox: el.getAttribute('role') === 'combobox' || el.getAttribute('aria-autocomplete') === 'list',
          isFieldsetOrGroup,
          alreadyFilled,
          hasError,
          currentValue,
          questionText: texts.join(' ').toLowerCase(),
          isRequired
        };
      }, field);

      // Rule 1: Never overwrite or re-select pre-filled fields UNLESS they have an error!
      if (info.alreadyFilled && !info.hasError) {
        continue;
      }

      if (!info.questionText) {
        continue;
      }

      // Rule 2: Match against answersConfig
      const matchedConfig = answersConfig.find(c => new RegExp(c.pattern, 'i').test(info.questionText));

      if (matchedConfig) {
        if (!info.isFieldsetOrGroup) {
          if (info.tagName === 'select') {
            const selectedVal = await page.evaluate((select, textToMatch, fallbackToMatch, preferredOptions) => {
              const opts = Array.from((select as HTMLSelectElement).options);
              let match: HTMLOptionElement | undefined = undefined;

              if (preferredOptions && preferredOptions.length > 0) {
                for (const pref of preferredOptions) {
                  match = opts.find(o => {
                    const t = o.text.trim().toLowerCase();
                    const v = o.value.trim().toLowerCase();
                    const tgt = pref.trim().toLowerCase();
                    if (t === tgt || v === tgt) return true;
                    if (tgt.length > 3) return t.includes(tgt) || v.includes(tgt);
                    return new RegExp('\\b' + tgt + '\\b').test(t) || new RegExp('\\b' + tgt + '\\b').test(v);
                  });
                  if (match) break;
                }
              }

              if (!match) {
                match = opts.find(o => {
                  const t = o.text.trim().toLowerCase();
                  const v = o.value.trim().toLowerCase();
                  const tgt = textToMatch.trim().toLowerCase();
                  if (t === tgt || v === tgt) return true;
                  if (tgt.length > 3) return t.includes(tgt) || v.includes(tgt);
                  return new RegExp('\\b' + tgt + '\\b').test(t) || new RegExp('\\b' + tgt + '\\b').test(v);
                });
              }

              if (!match && fallbackToMatch) {
                match = opts.find(o => {
                  const t = o.text.trim().toLowerCase();
                  const v = o.value.trim().toLowerCase();
                  const tgt = fallbackToMatch.trim().toLowerCase();
                  if (t === tgt || v === tgt) return true;
                  if (tgt.length > 3) return t.includes(tgt) || v.includes(tgt);
                  return new RegExp('\\b' + tgt + '\\b').test(t) || new RegExp('\\b' + tgt + '\\b').test(v);
                });
              }

              // Safe selection fallback: choose "Yes" or first option (never the last item / Zimbabwe)
              if (!match) {
                const validOpts = opts.filter(o => o.value && o.value !== 'Select an option' && o.value.trim() !== '');
                if (validOpts.length > 0) {
                  const yesOpt = validOpts.find(o => o.text.trim().toLowerCase() === 'yes');
                  match = yesOpt || validOpts[0];
                }
              }

              return match ? match.value : null;
            }, field, matchedConfig.textValue, (matchedConfig as any).dropdownValue, (matchedConfig as any).preferredOptions);

            if (selectedVal) {
              await page.evaluate((select, val) => {
                const sel = select as HTMLSelectElement;
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
                if (nativeSetter) {
                  nativeSetter.call(sel, val);
                } else {
                  sel.value = val;
                }
                sel.dispatchEvent(new Event('input', { bubbles: true }));
                sel.dispatchEvent(new Event('change', { bubbles: true }));
              }, field, selectedVal);
              await delay(WAIT_TIME_AUTO_APPLY);
            }
          } else if (['text', 'tel', 'number', 'email', 'url', ''].includes(info.type) || info.tagName === 'textarea') {
            const valToType = resolveDynamicValue(
              (info.id.toLowerCase().includes('numeric') || info.type === 'number')
                ? (matchedConfig.numericValue || matchedConfig.textValue)
                : (matchedConfig.textValue || matchedConfig.numericValue)
            );

            // Set natively for React form state
            await field.evaluate((el, val) => {
              const input = el as HTMLInputElement | HTMLTextAreaElement;
              input.focus();
              const nativeSetter = Object.getOwnPropertyDescriptor(
                input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
                'value'
              )?.set;
              if (nativeSetter) {
                nativeSetter.call(input, val);
              } else {
                input.value = val;
              }
              input.dispatchEvent(new Event('input', { bubbles: true }));
              input.dispatchEvent(new Event('change', { bubbles: true }));
            }, valToType);

            // Keyboard entry
            await field.evaluate(el => (el as HTMLInputElement | HTMLTextAreaElement).select());
            await field.press('Backspace');
            await field.type(valToType);

            // Check if this input is a combobox, typeahead, or location/city field
            const isTypeaheadOrLocation = (
              info.isCombobox ||
              info.questionText.includes('location') ||
              info.questionText.includes('city') ||
              info.id.toLowerCase().includes('location') ||
              info.id.toLowerCase().includes('city') ||
              info.id.toLowerCase().includes('typeahead') ||
              info.questionText.includes('state') ||
              info.questionText.includes('country')
            );

            const dropdownOpened = await page.evaluate(() => {
              const popups = document.querySelectorAll(
                '[role="listbox"], [role="option"], .artdeco-typeahead__results-list, .artdeco-typeahead__result'
              );
              return Array.from(popups).some(el => (el as HTMLElement).offsetParent !== null);
            });

            if (isTypeaheadOrLocation || dropdownOpened) {
              await handleTypeaheadSelection(page, field, valToType);
            }

            await field.evaluate(el => {
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
              el.dispatchEvent(new Event('blur', { bubbles: true }));
            });

            await delay(WAIT_TIME_AUTO_APPLY);
          } else if (info.type === 'radio') {
            await field.evaluate(el => {
              const r = el as HTMLInputElement;
              const label = r.closest('label') || document.querySelector(`label[for="${r.id}"]`);
              if (label) (label as HTMLElement).click();
              else r.click();
            });
            await delay(WAIT_TIME_AUTO_APPLY);
          }
        } else {
          // Fieldset / radiogroup handling
          const clicked = await page.evaluate((fs, textToMatch, fallbackToMatch, preferredOptions) => {
            const radioLabels = Array.from(fs.querySelectorAll('label, [role="radio"], [data-test-radio-button]'));
            let targetLabel: HTMLElement | undefined = undefined;

            if (preferredOptions && preferredOptions.length > 0) {
              for (const pref of preferredOptions) {
                targetLabel = radioLabels.find(l => {
                  const t = (l.textContent || '').trim().toLowerCase();
                  const tgt = pref.trim().toLowerCase();
                  if (t === tgt) return true;
                  if (tgt.length > 3) return t.includes(tgt);
                  return new RegExp('\\b' + tgt + '\\b').test(t);
                }) as HTMLElement | undefined;
                if (targetLabel) break;
              }
            }

            if (!targetLabel) {
              targetLabel = radioLabels.find(l => {
                const t = (l.textContent || '').trim().toLowerCase();
                const tgt = textToMatch.trim().toLowerCase();
                if (t === tgt) return true;
                if (tgt.length > 3) return t.includes(tgt);
                return new RegExp('\\b' + tgt + '\\b').test(t);
              }) as HTMLElement | undefined;
            }

            if (!targetLabel && fallbackToMatch) {
              targetLabel = radioLabels.find(l => {
                const t = (l.textContent || '').trim().toLowerCase();
                const tgt = fallbackToMatch.trim().toLowerCase();
                if (t === tgt) return true;
                if (tgt.length > 3) return t.includes(tgt);
                return new RegExp('\\b' + tgt + '\\b').test(t);
              }) as HTMLElement | undefined;
            }

            if (!targetLabel && radioLabels.length > 0) {
              const yesLabel = radioLabels.find(l => l.textContent?.trim().toLowerCase() === 'yes');
              targetLabel = (yesLabel || radioLabels[0]) as HTMLElement;
            }

            if (targetLabel) {
              let input = targetLabel.querySelector('input');
              if (!input) {
                const forAttr = targetLabel.getAttribute('for');
                if (forAttr) input = document.getElementById(forAttr) as HTMLInputElement;
              }
              if (input && (input as HTMLInputElement).checked) {
                return false;
              }
              targetLabel.click();
              if (input && !(input as HTMLInputElement).checked) {
                input.click();
              }
              return true;
            }
            return false;
          }, field, matchedConfig.textValue, (matchedConfig as any).dropdownValue, (matchedConfig as any).preferredOptions);

          if (clicked) await delay(WAIT_TIME_AUTO_APPLY);
        }
      } else if (info.isRequired) {
        // Rule 3: Single clean fallback for unmatched REQUIRED fields
        if (info.tagName === 'select') {
          await page.evaluate(select => {
            const sel = select as HTMLSelectElement;
            const validOpts = Array.from(sel.options).filter(o => o.value && o.value !== 'Select an option' && o.value.trim() !== '');
            if (validOpts.length > 0) {
              const yesOpt = validOpts.find(o => o.text.trim().toLowerCase() === 'yes');
              sel.value = yesOpt ? yesOpt.value : validOpts[0].value;
              sel.dispatchEvent(new Event('input', { bubbles: true }));
              sel.dispatchEvent(new Event('change', { bubbles: true }));
            }
          }, field);
          await delay(WAIT_TIME_AUTO_APPLY);
        } else if (info.isFieldsetOrGroup) {
          await page.evaluate(fs => {
            const labels = Array.from(fs.querySelectorAll('label, [role="radio"]'));
            if (labels.length > 0) {
              const yesLabel = labels.find(l => l.textContent?.trim().toLowerCase() === 'yes');
              const target = (yesLabel || labels[0]) as HTMLElement;
              target.click();
            }
          }, field);
          await delay(WAIT_TIME_AUTO_APPLY);
        } else if (['text', 'tel', 'number', 'email', 'url', ''].includes(info.type) || info.tagName === 'textarea') {
          let fallbackVal = 'NA';
          const q = info.questionText;
          if (q.includes('notice') || q.includes('days')) fallbackVal = '30';
          else if (q.includes('ctc') || q.includes('salary') || q.includes('compensation') || q.includes('inr')) fallbackVal = '1048000';
          else if (q.includes('experience') || q.includes('years')) fallbackVal = '2';
          else if (q.includes('linkedin')) fallbackVal = 'https://www.linkedin.com/in/dhiraj-karangale-464ab91bb';
          else if (q.includes('portfolio') || q.includes('url') || q.includes('website')) fallbackVal = 'https://dhirajkarangale.vercel.app';
          else if (q.includes('city') || q.includes('location')) fallbackVal = 'Pune';
          else if (info.type === 'number' || info.type === 'tel') fallbackVal = '1';

          await field.evaluate((el, val) => {
            const input = el as HTMLInputElement | HTMLTextAreaElement;
            const nativeSetter = Object.getOwnPropertyDescriptor(
              input instanceof HTMLTextAreaElement ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype,
              'value'
            )?.set;
            if (nativeSetter) nativeSetter.call(input, val);
            else input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }, fallbackVal);

          await field.evaluate(el => (el as HTMLInputElement | HTMLTextAreaElement).select());
          await field.press('Backspace');
          await field.type(fallbackVal);

          if (q.includes('city') || q.includes('location') || info.isCombobox) {
            await handleTypeaheadSelection(page, field, fallbackVal);
          }

          await field.evaluate(el => {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('blur', { bubbles: true }));
          });
          await delay(WAIT_TIME_AUTO_APPLY);
        }
      }
    }

    // 4. Final verification: ensure no required text input remains empty
    const stillEmpty = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"][required], input[type="text"][aria-required="true"]'));
      return inputs.some(input => !(input as HTMLInputElement).value?.trim());
    });

    return !stillEmpty;
  } catch (error) {
    console.error("[LinkedIn AutoApply] Error in handleQuestions:", error);
    return false;
  }
}
