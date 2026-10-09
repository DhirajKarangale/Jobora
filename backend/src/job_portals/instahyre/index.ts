import { type Page } from "puppeteer-core";
import { ResilientBrowser } from "../../utils/resilientBrowser.ts";
import { setTimeout as delay } from "node:timers/promises";
import { extractJobData } from "./jobData.ts";
import { INSTAHYRE_URL_JOB_SEARCH, isBlacklistedCompany, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsAutoApplied } from "../../utils/automationState.ts";

async function applyJobs(page: Page): Promise<void> {
  while (true) {
    try {
      await page.waitForSelector('.apply button', { visible: true, timeout: 5000 });
      const applyBtn = await page.$('.apply button');

      if (!applyBtn) {
        break;
      }

      const { companyName, isAlreadyProcessed } = await extractJobData(page);
      
      const isBlacklisted = companyName ? isBlacklistedCompany(companyName) : false;

      if (isAlreadyProcessed || isBlacklisted) {
        const skipped = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const skipBtn = btns.find(b => {
            const text = (b.innerText || '').toLowerCase().trim();
            return text.includes('not interested') || text.includes('no thanks') || text.includes('decline') || text.includes('skip');
          });
          if (skipBtn) {
            skipBtn.click();
            return true;
          }
          return false;
        });

        if (!skipped) {
          console.log("Could not find skip/decline button. Exiting loop.");
          break;
        }

        await delay(WAIT_TIME);
        continue;
      }

      if (companyName) {
        await page.evaluate((btn: any) => btn.click(), applyBtn);
        
        await delay(WAIT_TIME);
        
        // Strictly check and dismiss the 'Follow us / premium' modal if it appeared after applying
        await page.evaluate(() => {
          const modalWraps = document.querySelectorAll('.application-modal-wrap');
          for (const wrap of Array.from(modalWraps)) {
            const text = wrap.textContent?.toLowerCase() || '';
            if (text.includes('follow us') || text.includes('premium') || text.includes('move your application to the top')) {
              if ((wrap as HTMLElement).offsetWidth > 0) {
                const closeBtn = wrap.querySelector('.application-modal-close, .fa-close') as HTMLElement;
                if (closeBtn) closeBtn.click();
              }
            }
          }
        });
        await delay(500);

        const isSuccess = await page.evaluate((oldName) => {
          const currentName = document.querySelector("h2.company-name")?.textContent?.trim();
          const applyBtnExists = !!document.querySelector('.apply button');
          return !applyBtnExists || currentName !== oldName;
        }, companyName);

        if (isSuccess) {
          incrementJobsAutoApplied();
        }
      }

    } catch (error) {
      break;
    }
  }
}

async function processAllVisibleJobs(page: Page) {
  let consecutiveNoJobs = 0;
  while (consecutiveNoJobs < 2) {
    let clicked = false;
    try {
      clicked = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('.btn-interested')) as HTMLElement[];
        const visibleBtn = btns.find(b => b.offsetWidth > 0 && b.offsetHeight > 0 && !b.hasAttribute('data-clicked'));
        if (visibleBtn) {
           visibleBtn.click();
           visibleBtn.setAttribute('data-clicked', 'true');
           return true;
        }
        return false;
      });
    } catch (e) {}

    if (!clicked) {
      consecutiveNoJobs++;
      await delay(WAIT_TIME);
      continue;
    }
    
    consecutiveNoJobs = 0;
    await delay(WAIT_TIME);
    await applyJobs(page);
    await delay(WAIT_TIME);
  }
}

export default async function instahyer(resilientBrowser: ResilientBrowser): Promise<void> {
  const page = await resilientBrowser.newPage();

  try {
    await page.goto(INSTAHYRE_URL_JOB_SEARCH, { waitUntil: "load" });

    try {
      await delay(WAIT_TIME);
      await processAllVisibleJobs(page);
    } catch (error) {
      console.error("Failed to apply on root page", error);
    }

    try {
      const clickedDk = await page.evaluate(() => {
        const searchNames = Array.from(document.querySelectorAll('.saved-search-name, span, div.ng-binding, a'));
        const dkElement = searchNames.find(el => el.textContent?.trim().toLowerCase() === 'dk');
        
        if (dkElement) {
          let container = dkElement.parentElement;
          let searchBtn = null;
          
          for (let i = 0; i < 5 && container; i++) {
            searchBtn = container.querySelector('a[ng-click*="selectSearch"]');
            if (searchBtn) break;
            container = container.parentElement;
          }
          
          if (searchBtn) {
            (searchBtn as HTMLElement).click();
          } else {
            (dkElement as HTMLElement).click();
          }
          
          return true;
        }
        return false;
      });

      if (!clickedDk) {
        console.log("[Instahyre] Could not find 'dk' saved search.");
      } else {
        await delay(WAIT_TIME * 2);
        
        try {
          await processAllVisibleJobs(page);
        } catch (e) {
          console.log("[Instahyre] No jobs found in dk search.");
        }
      }
    } catch (error) {
      console.log("Error processing dk search:", error);
    }
  } finally {
    await page.close();
  }
}
