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
                      if (preferredOptions.includes('FIRST_OPTION')) {
                        const validOpts = opts.filter(o => o.value && o.value !== 'Select an option' && o.value.trim() !== '');
                        if (validOpts.length > 0) match = validOpts[0];
                      } else {
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

                  const errorMsg = await page.evaluate((id) => {
                    const errorEl = document.getElementById(`${id}-error`);
                    return errorEl && errorEl.textContent ? errorEl.textContent.trim() : '';
                  }, inputId);

                  let fallbackNumeric = resolveDynamicValue((config as any).fallbackNumericValue);
                  let fallbackText = resolveDynamicValue((config as any).fallbackTextValue);

                  if (errorMsg.toLowerCase().includes('number') || errorMsg.toLowerCase().includes('decimal')) {
                    fallbackNumeric = fallbackNumeric || "2";
                    fallbackText = fallbackText || "2";
                  }

                  if (errorMsg.length > 0 && (fallbackNumeric || fallbackText)) {
                    await inputEl.evaluate(el => (el as HTMLInputElement).select());
                    await inputEl.press('Backspace');

                    if (errorMsg.toLowerCase().includes('number') || errorMsg.toLowerCase().includes('decimal')) {
                      await inputEl.type(fallbackNumeric);
                    } else if (inputId.toLowerCase().includes('numeric') && fallbackNumeric) {
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
              const clicked = await page.evaluate((fs, textToMatch, fallbackToMatch, preferredOptions, numericValue) => {
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
                  if (preferredOptions.includes('FIRST_OPTION')) {
                    targetLabel = radioLabels[0];
                  } else if (preferredOptions.includes('SMALLEST_GREATER_THAN_NUMERIC') && numericValue) {
                    const targetNum = parseFloat(numericValue);
                    if (!isNaN(targetNum)) {
                      let bestLabel = null;
                      let minDiff = Infinity;
                      for (const l of radioLabels) {
                        const txt = l.textContent || '';
                        const matches = txt.match(/\d+/g);
                        if (matches) {
                          const nums = matches.map(m => parseInt(m, 10));
                          const optMax = Math.max(...nums);
                          if (optMax >= targetNum) {
                            const diff = optMax - targetNum;
                            if (diff < minDiff) {
                              minDiff = diff;
                              bestLabel = l;
                            }
                          }
                        }
                      }
                      if (bestLabel) targetLabel = bestLabel;
                    }
                  }
                  
                  if (!targetLabel) {
                    targetLabel = radioLabels.find(l => {
                      const txt = l.textContent?.trim().toLowerCase() || '';
                      return txt.includes('other') || txt.includes('none') || txt.includes('not listed');
                    });
                    if (!targetLabel) {
                      targetLabel = radioLabels[radioLabels.length - 1];
                    }
                  }
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
                  return true;
                }
                return false;
              }, fieldset, config.textValue, (config as any).dropdownValue, (config as any).preferredOptions, config.numericValue);

              if (clicked) await delay(500);
            }
          }

          matchedConfig = true;
          break;
        }
      }

      if (!matchedConfig) {
        if (tagName === 'legend') {
          const clickedFallback = await page.evaluate((el) => {
            const fs = el.closest('fieldset');
            if (fs) {
              const options = Array.from(fs.querySelectorAll('label'));
              if (options.length === 1) {
                const input = fs.querySelector('input');
                if (input && !(input as HTMLInputElement).checked) {
                  (options[0] as HTMLElement).click();
                  return true;
                }
              }
              if (options.length >= 2) {
                const yesLabel = options.find(l => l.textContent?.trim().toLowerCase() === 'yes');
                if (yesLabel) {
                  let input = yesLabel.querySelector('input');
                  if (!input) {
                    const forAttr = yesLabel.getAttribute('for');
                    if (forAttr) input = document.getElementById(forAttr) as HTMLInputElement;
                  }
                  if (!input || !(input as HTMLInputElement).checked) {
                    yesLabel.click();
                    return true;
                  }
                }
                
                const firstLabel = options[0];
                let input = firstLabel.querySelector('input');
                if (!input) {
                  const forAttr = firstLabel.getAttribute('for');
                  if (forAttr) input = document.getElementById(forAttr) as HTMLInputElement;
                }
                if (!input || !(input as HTMLInputElement).checked) {
                  (firstLabel as HTMLElement).click();
                  return true;
                }
              }
            }
            return false;
          }, labelEl);

          if (clickedFallback) {
            await delay(500);
          }
        } else if (tagName === 'label') {
          const fallbackSelect = await page.evaluate((el) => {
            const forAttr = el.getAttribute('for');
            if (forAttr) {
              const input = document.getElementById(forAttr);
              if (input && input.tagName.toLowerCase() === 'select') {
                const select = input as HTMLSelectElement;
                if (!select.value || select.value === 'Select an option') {
                  const validOpts = Array.from(select.options).filter(o => o.value && o.value !== 'Select an option' && o.value.trim() !== '');
                  if (validOpts.length > 0) {
                    select.value = validOpts[0].value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                    select.dispatchEvent(new Event('input', { bubbles: true }));
                    return true;
                  }
                }
              }
            }
            return false;
          }, labelEl);
          
          if (fallbackSelect) {
            await delay(500);
          }
        }
      }
    }

    const fallbackResult = await page.evaluate(() => {
      let filledSomething = false;

      const selects = Array.from(document.querySelectorAll('select'));
      for (const select of selects) {
        if (!select.value || select.value === 'Select an option' || select.value.trim() === '') {
          const validOpts = Array.from(select.options).filter(o => o.value && o.value !== 'Select an option' && o.value.trim() !== '');
          if (validOpts.length > 0) {
            const yesOpt = validOpts.find(o => o.text.trim().toLowerCase() === 'yes');
            if (yesOpt) {
              select.value = yesOpt.value;
            } else {
              select.value = validOpts[0].value;
            }
            select.dispatchEvent(new Event('change', { bubbles: true }));
            select.dispatchEvent(new Event('input', { bubbles: true }));
            filledSomething = true;
          }
        }
      }

      const textInputs = Array.from(document.querySelectorAll('input[type="text"], input:not([type]), textarea'));
      for (const input of textInputs) {
        const el = input as HTMLInputElement | HTMLTextAreaElement;
        const isRequired = el.required || el.getAttribute('aria-required') === 'true';
        if (isRequired && !el.value.trim()) {
          el.value = 'NA';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          filledSomething = true;
        }
      }

      const numberInputs = Array.from(document.querySelectorAll('input[type="number"], input[type="tel"]'));
      for (const input of numberInputs) {
        const el = input as HTMLInputElement;
        const isRequired = el.required || el.getAttribute('aria-required') === 'true';
        if (isRequired && !el.value.trim()) {
          el.value = '1';
          el.dispatchEvent(new Event('input', { bubbles: true }));
          el.dispatchEvent(new Event('change', { bubbles: true }));
          filledSomething = true;
        }
      }
      
      const fieldsets = Array.from(document.querySelectorAll('fieldset'));
      for (const fs of fieldsets) {
        const inputs = Array.from(fs.querySelectorAll('input[type="radio"], input[type="checkbox"]')) as HTMLInputElement[];
        const anyChecked = inputs.some(i => i.checked);
        
        if (!anyChecked && inputs.length > 0) {
          const labels = Array.from(fs.querySelectorAll('label'));
          if (labels.length > 0) {
             const yesLabel = labels.find(l => l.textContent?.trim().toLowerCase() === 'yes');
             if (yesLabel) {
               yesLabel.click();
               filledSomething = true;
             } else {
               labels[0].click();
               filledSomething = true;
             }
          }
        }
      }

      const remainingInputs = Array.from(document.querySelectorAll('input[type="text"][required], input[type="text"][aria-required="true"]'));
      const stillEmpty = remainingInputs.some(input => !(input as HTMLInputElement).value.trim());

      return { filledSomething, stillEmpty };
    });

    if (fallbackResult.filledSomething) {
      await delay(500);
    }

    if (fallbackResult.stillEmpty) return false;

    return true;
  } catch (error) {
    return false;
  }
}
