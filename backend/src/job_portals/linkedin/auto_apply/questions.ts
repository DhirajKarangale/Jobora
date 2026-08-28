import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import answersConfig from "./answers.json" with { type: "json" };

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

export async function handleQuestions(page: Page): Promise<boolean> {
  try {
    const labels = await page.$$('label, legend');

    for (const labelEl of labels) {
      const labelText = await page.evaluate(el => el.textContent?.trim().toLowerCase() || '', labelEl);
      const tagName = await page.evaluate(el => el.tagName.toLowerCase(), labelEl);
      let matchedConfig = false;

      for (const config of answersConfig) {
        const regex = new RegExp(config.pattern, 'i');

        if (regex.test(labelText)) {

          if (tagName === 'label') {
            const forAttr = await page.evaluate(el => el.getAttribute('for'), labelEl);

            if (forAttr) {
              const inputElHandle = await page.evaluateHandle((id) => document.getElementById(id), forAttr);
              const inputEl = inputElHandle.asElement() as import('puppeteer-core').ElementHandle<Element> | null;

              if (inputEl) {
                const nodeInfo = await page.evaluate(el => {
                  return {
                    tagName: el.tagName.toLowerCase(),
                    type: (el as HTMLInputElement).type || ''
                  };
                }, inputEl);

                if (nodeInfo.tagName === 'select') {
                  const optionValue = await page.evaluate((select, textToMatch, fallbackToMatch, preferredOptions) => {
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

                    if (!match && preferredOptions) {
                      match = opts.find(o => {
                        const txt = o.text.toLowerCase();
                        return txt.includes('other') || txt.includes('none') || txt.includes('not listed');
                      });
                      if (!match) {
                        const validOpts = opts.filter(o => o.value && o.value !== 'Select an option' && o.value.trim() !== '');
                        if (validOpts.length > 0) {
                          match = validOpts[validOpts.length - 1];
                        }
                      }
                    }

                    return match ? match.value : null;
                  }, inputEl, config.textValue, (config as any).dropdownValue, (config as any).preferredOptions);

                  if (optionValue) {
                    await page.evaluate((select, val) => {
                      (select as HTMLSelectElement).value = val;
                      select.dispatchEvent(new Event('change', { bubbles: true }));
                    }, inputEl, optionValue);
                    await delay(500);
                  }
                } else if ((nodeInfo.tagName === 'input' && nodeInfo.type === 'text') || nodeInfo.tagName === 'textarea') {
                  const inputId = await page.evaluate(el => el.getAttribute('id') || '', inputEl);

                  await inputEl.evaluate(el => (el as HTMLInputElement | HTMLTextAreaElement).select());
                  await inputEl.press('Backspace');

                  if (inputId.toLowerCase().includes('numeric')) {
                    await inputEl.type(resolveDynamicValue(config.numericValue));
                  } else {
                    await inputEl.type(resolveDynamicValue(config.textValue));
                  }

                  const isCombobox = await page.evaluate(el => el.getAttribute('role') === 'combobox', inputEl);
                  if (isCombobox) {
                    await delay(1500);
                    await inputEl.press('ArrowDown');
                    await inputEl.press('Enter');
                  }

                  await page.evaluate(el => {
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true }));
                  }, inputEl);

                  await delay(300);

                  const hasError = await page.evaluate((id) => {
                    const errorEl = document.getElementById(`${id}-error`);
                    return errorEl && errorEl.textContent && errorEl.textContent.trim().length > 0;
                  }, inputId);

                  const fallbackNumeric = resolveDynamicValue((config as any).fallbackNumericValue);
                  const fallbackText = resolveDynamicValue((config as any).fallbackTextValue);

                  if (hasError && (fallbackNumeric || fallbackText)) {
                    await inputEl.evaluate(el => (el as HTMLInputElement).select());
                    await inputEl.press('Backspace');

                    if (inputId.toLowerCase().includes('numeric') && fallbackNumeric) {
                      await inputEl.type(fallbackNumeric);
                    } else if (fallbackText) {
                      await inputEl.type(fallbackText);
                    }

                    await page.evaluate(el => {
                      el.dispatchEvent(new Event('input', { bubbles: true }));
                      el.dispatchEvent(new Event('change', { bubbles: true }));
                    }, inputEl);
                  }

                  await delay(300);
                }
              }
            }
          } else if (tagName === 'legend') {
            const fieldsetHandle = await page.evaluateHandle(el => el.closest('fieldset'), labelEl);
            const fieldset = fieldsetHandle.asElement() as import('puppeteer-core').ElementHandle<Element> | null;

            if (fieldset) {
              const clicked = await page.evaluate((fs, textToMatch, fallbackToMatch, preferredOptions) => {
                const radioLabels = Array.from(fs.querySelectorAll('label'));
                let targetLabel: HTMLLabelElement | undefined = undefined;

                if (preferredOptions && preferredOptions.length > 0) {
                  for (const pref of preferredOptions) {
                    targetLabel = radioLabels.find(l => {
                      const t = (l.textContent || '').trim().toLowerCase();
                      const tgt = pref.trim().toLowerCase();
                      if (t === tgt) return true;
                      if (tgt.length > 3) return t.includes(tgt);
                      return new RegExp('\\b' + tgt + '\\b').test(t);
                    });
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
                  });
                }

                if (!targetLabel && fallbackToMatch) {
                  targetLabel = radioLabels.find(l => {
                    const t = (l.textContent || '').trim().toLowerCase();
                    const tgt = fallbackToMatch.trim().toLowerCase();
                    if (t === tgt) return true;
                    if (tgt.length > 3) return t.includes(tgt);
                    return new RegExp('\\b' + tgt + '\\b').test(t);
                  });
                }

                if (!targetLabel && preferredOptions && radioLabels.length > 0) {
                  targetLabel = radioLabels.find(l => {
                    const txt = l.textContent?.trim().toLowerCase() || '';
                    return txt.includes('other') || txt.includes('none') || txt.includes('not listed');
                  });
                  if (!targetLabel) {
                    targetLabel = radioLabels[radioLabels.length - 1];
                  }
                }

                if (targetLabel) {
                  targetLabel.click();
                  return true;
                }
                return false;
              }, fieldset, config.textValue, (config as any).dropdownValue, (config as any).preferredOptions);

              if (clicked) await delay(500);
            }
          }

          matchedConfig = true;
          break;
        }
      }

      if (!matchedConfig && tagName === 'legend') {
        const clickedFallback = await page.evaluate((el) => {
          const fs = el.closest('fieldset');
          if (fs) {
            const options = fs.querySelectorAll('label');
            if (options.length === 1) {
              const input = fs.querySelector('input');
              if (input && !(input as HTMLInputElement).checked) {
                (options[0] as HTMLElement).click();
                return true;
              }
            }
          }
          return false;
        }, labelEl);

        if (clickedFallback) {
          await delay(500);
        }
      }
    }

    const emptyInputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"][required], input[type="text"][aria-required="true"]'));
      return inputs.some(input => !(input as HTMLInputElement).value.trim());
    });

    if (emptyInputs) return false;

    return true;
  } catch (error) {
    return false;
  }
}
