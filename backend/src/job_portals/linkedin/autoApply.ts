import { type Page } from "puppeteer-core";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME } from "../../utils/constants.ts";
export async function handleResume(page: Page, targetResumeName: string = "DhirajKarangale.pdf"): Promise<boolean> {
  // Check if resume section is present
  const resumeContainers = await page.$$('.jobs-document-upload-redesign-card__container');
  if (resumeContainers.length === 0) {
    return false;
  }

  // Look for "Show more resumes" button and click it
  try {
    const showMoreBtn = await page.$('.jobs-document-upload__show-more-less-button');
    if (showMoreBtn) {
      const ariaLabel = await page.evaluate(el => el.getAttribute('aria-label') || '', showMoreBtn);
      if (ariaLabel.toLowerCase().includes('show') && ariaLabel.toLowerCase().includes('more resumes')) {
        await showMoreBtn.click();
        await delay(WAIT_TIME); // Wait for resumes to expand
      }
    }
  } catch (error) {
    console.error("Failed to click show more resumes:", error);
  }

  // Find and select the target resume
  const isSelected = await page.evaluate((targetName) => {
    const containers = Array.from(document.querySelectorAll('.jobs-document-upload-redesign-card__container'));
    
    for (const container of containers) {
      const fileNameEl = container.querySelector('.jobs-document-upload-redesign-card__file-name');
      if (fileNameEl) {
        const text = fileNameEl.textContent?.trim().toLowerCase() || '';
        const target = targetName.toLowerCase();
        const targetNoExt = target.replace(/\.pdf$/, '').replace(/\.docx$/, '');
        
        if (text === target || text.includes(targetNoExt)) {
          // Check if already selected
          const input = container.querySelector('input') as HTMLInputElement;
          if (input && input.checked) {
              return true; // Already selected, no need to click again
          }

          // Find the label for the radio button
          const label = container.querySelector('label.jobs-document-upload-redesign-card__toggle-label') as HTMLLabelElement;
          if (label) {
            label.click();
            return true;
          }
          
          // Fallback: click the container itself
          (container as HTMLElement).click();
          return true;
        }
      }
    }
    return false;
  }, targetResumeName);

  return isSelected;
}

export async function unfollowCompany(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      const checkbox = document.getElementById('follow-company-checkbox') as HTMLInputElement;
      if (checkbox && checkbox.checked) {
        const label = document.querySelector('label[for="follow-company-checkbox"]') as HTMLLabelElement;
        if (label) {
          label.click();
        } else {
          checkbox.click(); // Fallback
        }
      }
    });
  } catch (error) {
    console.error("Failed to uncheck follow company:", error);
  }
}

export async function submitApplication(page: Page): Promise<boolean> {
  try {
    const submitBtn = await page.$('button[aria-label="Submit application"]');
    if (submitBtn) {
      await submitBtn.click();
      await delay(WAIT_TIME); // Wait for submission to process
      return true;
    }
    return false;
  } catch (error) {
    console.error("Failed to click submit application:", error);
    return false;
  }
}

import answersConfig from "./answers.json" with { type: "json" };

export async function handleQuestions(page: Page): Promise<boolean> {
  try {
    const labels = await page.$$('label, legend');
    
    for (const labelEl of labels) {
      const labelText = await page.evaluate(el => el.textContent?.trim().toLowerCase() || '', labelEl);
      const tagName = await page.evaluate(el => el.tagName.toLowerCase(), labelEl);
      
      // Check against all patterns in our JSON config
      for (const config of answersConfig) {
        const regex = new RegExp(config.pattern, 'i');
        
        if (regex.test(labelText)) {
          
          if (tagName === 'label') {
            const forAttr = await page.evaluate(el => el.getAttribute('for'), labelEl);
            
            if (forAttr) {
              // Find the input associated with this label by ID
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
                  // Handle Select Dropdowns
                  const optionValue = await page.evaluate((select, textToMatch, fallbackToMatch, preferredOptions) => {
                      const isMatch = (optText: string, optVal: string, target: string) => {
                          const t = optText.trim().toLowerCase();
                          const v = optVal.trim().toLowerCase();
                          const tgt = target.trim().toLowerCase();
                          if (t === tgt || v === tgt) return true;
                          if (tgt.length > 3) return t.includes(tgt) || v.includes(tgt);
                          const regex = new RegExp(`\\b${tgt}\\b`);
                          return regex.test(t) || regex.test(v);
                      };
                      const opts = Array.from((select as HTMLSelectElement).options);
                      let match: HTMLOptionElement | undefined = undefined;
                      
                      // 1. Try preferred options in order
                      if (preferredOptions && preferredOptions.length > 0) {
                          for (const pref of preferredOptions) {
                              match = opts.find(o => isMatch(o.text, o.value, pref));
                              if (match) break;
                          }
                      }
                      
                      // 2. Try textToMatch or fallbackToMatch
                      if (!match) {
                          match = opts.find(o => isMatch(o.text, o.value, textToMatch));
                      }
                      if (!match && fallbackToMatch) {
                          match = opts.find(o => isMatch(o.text, o.value, fallbackToMatch));
                      }
                      
                      // 3. Select "Other" or last valid option if no match found (but preferredOptions was provided)
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
                          select.dispatchEvent(new Event('change', {bubbles: true})); 
                      }, inputEl, optionValue);
                      await delay(500);
                  }
                } else if ((nodeInfo.tagName === 'input' && nodeInfo.type === 'text') || nodeInfo.tagName === 'textarea') {
                  // Handle Text Inputs & Textareas
                  const inputId = await page.evaluate(el => el.getAttribute('id') || '', inputEl);
                  
                  // Clear the input field completely to overwrite any LinkedIn defaults
                  await inputEl.evaluate(el => (el as HTMLInputElement | HTMLTextAreaElement).select());
                  await inputEl.press('Backspace');
                  
                  if (inputId.toLowerCase().includes('numeric')) {
                    await inputEl.type(config.numericValue);
                  } else {
                    await inputEl.type(config.textValue);
                  }
                  
                  const isCombobox = await page.evaluate(el => el.getAttribute('role') === 'combobox', inputEl);
                  if (isCombobox) {
                    await delay(1500); // Wait for typeahead results to load
                    await inputEl.press('ArrowDown');
                    await inputEl.press('Enter');
                  }
                  
                  // Trigger events so React/Ember registers the input and validates
                  await page.evaluate(el => {
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('blur', { bubbles: true })); // Trigger validation
                  }, inputEl);
                  
                  await delay(300); // Wait a moment for UI validation to render
                  
                  // Check if LinkedIn threw a validation error
                  const hasError = await page.evaluate((id) => {
                     const errorEl = document.getElementById(`${id}-error`);
                     return errorEl && errorEl.textContent && errorEl.textContent.trim().length > 0;
                  }, inputId);
    
                  // If there's an error and we have fallback values defined in JSON, try them!
                  const fallbackNumeric = (config as any).fallbackNumericValue;
                  const fallbackText = (config as any).fallbackTextValue;
    
                  if (hasError && (fallbackNumeric || fallbackText)) {
                     console.log(`Validation error on field '${inputId}'. Falling back to alternative format...`);
                     
                     // Clear the field again
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
                  
                  await delay(300); // Small pause before moving to the next question
                }
              }
            }
          } else if (tagName === 'legend') {
             // Handle Radio Buttons inside Fieldsets
             const fieldsetHandle = await page.evaluateHandle(el => el.closest('fieldset'), labelEl);
             const fieldset = fieldsetHandle.asElement() as import('puppeteer-core').ElementHandle<Element> | null;
             
             if (fieldset) {
                 const clicked = await page.evaluate((fs, textToMatch, fallbackToMatch, preferredOptions) => {
                     const isMatch = (optText: string, target: string) => {
                          const t = optText.trim().toLowerCase();
                          const tgt = target.trim().toLowerCase();
                          if (t === tgt) return true;
                          if (tgt.length > 3) return t.includes(tgt);
                          const regex = new RegExp(`\\b${tgt}\\b`);
                          return regex.test(t);
                     };
                     const radioLabels = Array.from(fs.querySelectorAll('label'));
                     let targetLabel: HTMLLabelElement | undefined = undefined;
                     
                     // 1. Try preferred options
                     if (preferredOptions && preferredOptions.length > 0) {
                         for (const pref of preferredOptions) {
                             targetLabel = radioLabels.find(l => isMatch(l.textContent || '', pref));
                             if (targetLabel) break;
                         }
                     }
                     
                     // 2. Try textToMatch
                     if (!targetLabel) {
                         targetLabel = radioLabels.find(l => isMatch(l.textContent || '', textToMatch));
                     }
                     
                     // 2.5 Try fallbackToMatch (dropdownValue)
                     if (!targetLabel && fallbackToMatch) {
                         targetLabel = radioLabels.find(l => isMatch(l.textContent || '', fallbackToMatch));
                     }
                     
                     // 3. Fallback to "Other" or last radio if preferredOptions exist
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
          
          // Break out of the config loop if we found a match for this label/legend
          break;
        }
      }
    }
    
    // Check if any required input on the page is still empty
    // (This includes inputs we didn't know how to answer)
    const emptyInputs = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"][required], input[type="text"][aria-required="true"]'));
      return inputs.some(input => !(input as HTMLInputElement).value.trim());
    });
    
    if (emptyInputs) {
      console.log("Found empty required input(s) that we don't know how to answer. Stopping.");
      return false;
    }
    
    return true;
  } catch (error) {
    console.error("Failed to handle questions:", error);
    return false;
  }
}

export async function handleEasyApply(page: Page): Promise<boolean> {
  // TODO: Add logic to click "Easy Apply" button and iterate through modal pages.
  // When on the resume page, call:
  // await handleResume(page, "DhirajKarangale.pdf");
  
  // For answering questions:
  // const allFilled = await handleQuestions(page);
  // if (!allFilled) return false;

  // When reaching the end of the form, call:
  // await unfollowCompany(page);
  // await submitApplication(page);

  // For now, as per instructions, fail every auto apply for testing.
  return false;
}
