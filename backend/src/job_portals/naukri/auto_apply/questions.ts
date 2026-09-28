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

export async function handleNaukriQuestions(page: Page): Promise<boolean> {
  let previousQuestion = "";
  let stuckCount = 0;

  while (true) {
    try {
      const isChatbotVisible = await page.evaluate(() => {
        const drawer = document.querySelector('.chatbot_DrawerContentWrapper');
        return drawer && window.getComputedStyle(drawer).display !== 'none';
      });

      if (!isChatbotVisible) {
        return true;
      }

      await delay(WAIT_TIME_AUTO_APPLY);

      const questionText = await page.evaluate(() => {
        const botItems = Array.from(document.querySelectorAll('.botItem .botMsg span'));
        if (botItems.length === 0) return '';
        for (let i = botItems.length - 1; i >= 0; i--) {
           const txt = botItems[i].textContent?.trim();
           if (txt) return txt.toLowerCase();
        }
        return '';
      });

      console.log("[Naukri Bot] Question:", questionText);

      if (!questionText) {
         await delay(1000);
         stuckCount++;
         if (stuckCount > 5) return false;
         continue;
      }

      if (questionText === previousQuestion) {
         stuckCount++;
         if (stuckCount > 3) return false;
      } else {
         stuckCount = 0;
         previousQuestion = questionText;
      }
      
      const inputHandle = await page.$('.chatbot_InputContainer .textArea[contenteditable="true"]');
      if (!inputHandle) {
         const handledRadioOrSelect = await page.evaluate((qText, configs) => {
             const drawer = document.querySelector('.chatbot_DrawerContentWrapper');
             if (!drawer) return false;

             // Check if the question matches any config in answers.json
             let matchedConfig: any = null;
             for (const config of configs) {
                 try {
                     const regex = new RegExp(config.pattern, 'i');
                     if (regex.test(qText)) {
                         matchedConfig = config;
                         break;
                     }
                 } catch(e) {}
             }

             const matchesConfig = (optText: string) => {
                 if (!matchedConfig) return false;
                 const txt = optText.trim().toLowerCase();
                 if (matchedConfig.preferredOptions) {
                     for (const p of matchedConfig.preferredOptions) {
                         if (txt.includes(p.toLowerCase())) return true;
                     }
                 }
                 const tVal = (matchedConfig.textValue || '').toString().toLowerCase();
                 const nVal = (matchedConfig.numericValue || '').toString().toLowerCase();
                 const dVal = (matchedConfig.dropdownValue || '').toString().toLowerCase();
                 if (tVal && txt.includes(tVal)) return true;
                 if (nVal && txt.includes(nVal)) return true;
                 if (dVal && txt.includes(dVal)) return true;
                 return false;
             };

             // Check for <select> elements
             const selects = Array.from(drawer.querySelectorAll('select'));
             if (selects.length > 0) {
                 for (const select of selects) {
                     const opts = Array.from(select.options);
                     let targetOpt = opts.find(o => matchesConfig(o.text));
                     
                     if (!targetOpt) {
                         targetOpt = opts[1] || opts[0];
                     }

                     select.value = targetOpt.value;
                     select.dispatchEvent(new Event('change', { bubbles: true }));
                 }
                 return true;
             }

             const isLocation = qText.includes('resid') || qText.includes('locat') || qText.includes('relocat') || qText.includes('available for');
             
             // Gather all likely clickable radio option elements in the active drawer
             const options = Array.from(drawer.querySelectorAll('.ssrc__radio-btn-container, button, li, div')).filter(el => {
                 const classList = el.className || '';
                 const isRadioContainer = classList.includes('ssrc__radio-btn-container') || classList.includes('radio') || classList.includes('chip') || classList.includes('option');
                 const hasRadioRole = el.getAttribute('role') === 'radio';
                 const hasInputRadio = el.querySelector('input[type="radio"]');
                 const isLabel = el.tagName.toLowerCase() === 'label';
                 
                 const text = el.textContent?.trim() || '';
                 return (isRadioContainer || hasRadioRole || hasInputRadio || isLabel) && text.length > 0 && text.length < 50;
             }) as HTMLElement[];

             // Filter out nested duplicates
             const uniqueOptions = options.filter(opt => !options.some(other => other !== opt && other.contains(opt)));

             if (uniqueOptions.length > 0) {
                 let target = uniqueOptions.find(o => matchesConfig(o.textContent || ''));
                 
                 if (!target) {
                     target = uniqueOptions.find(o => o.textContent?.trim().toLowerCase() === 'yes') || uniqueOptions[0];
                 }

                 if (target) {
                     const radioInput = target.querySelector('input[type="radio"]') as HTMLInputElement;
                     if (radioInput) radioInput.click();
                     else target.click();
                     return true;
                 }
             }
             return false;
         }, questionText, answersConfig);

         if (handledRadioOrSelect) {
             await delay(WAIT_TIME_AUTO_APPLY);
             // Try to click save if it's required for radios
             const saveBtn = await page.$('.sendMsgbtn_container .send:not(.disabled) .sendMsg');
             if (saveBtn) await saveBtn.click();
             await delay(WAIT_TIME_AUTO_APPLY);
             stuckCount = 0;
             continue;
         }

         await delay(1000);
         continue;
      }

      let answerTyped = false;

      for (const config of answersConfig) {
        const regex = new RegExp(config.pattern, 'i');
        if (regex.test(questionText)) {
           const answer = resolveDynamicValue(config.textValue) || resolveDynamicValue(config.numericValue) || 'Yes';
           await inputHandle.click();
           await inputHandle.evaluate((el, text) => {
               const elem = el as HTMLElement;
               elem.focus();
               document.execCommand('selectAll', false, undefined);
               document.execCommand('insertText', false, text);
               elem.dispatchEvent(new Event('input', { bubbles: true }));
               elem.dispatchEvent(new Event('change', { bubbles: true }));
               elem.dispatchEvent(new Event('blur', { bubbles: true }));
           }, answer);
           answerTyped = true;
           console.log("[Naukri Bot] Typed answer:", answer);
           break;
        }
      }

      if (!answerTyped) {
         let fallback = 'NA';
         
         await inputHandle.click();
         await inputHandle.evaluate((el, text) => {
             const elem = el as HTMLElement;
             elem.focus();
             document.execCommand('selectAll', false, undefined);
             document.execCommand('insertText', false, text);
             elem.dispatchEvent(new Event('input', { bubbles: true }));
             elem.dispatchEvent(new Event('change', { bubbles: true }));
             elem.dispatchEvent(new Event('blur', { bubbles: true }));
         }, fallback);
         console.log("[Naukri Bot] Typed fallback:", fallback);
      }

      await delay(WAIT_TIME_AUTO_APPLY);

      const saveBtn = await page.$('.sendMsgbtn_container .send:not(.disabled) .sendMsg');
      if (saveBtn) {
         await saveBtn.click();
         await delay(WAIT_TIME_AUTO_APPLY);
      } else {
         stuckCount++;
         if (stuckCount > 5) return false;
      }

    } catch (e) {
      stuckCount++;
      if (stuckCount > 5) return false;
      await delay(1000);
    }
  }
}
