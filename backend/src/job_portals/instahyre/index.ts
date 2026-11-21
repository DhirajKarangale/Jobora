import { type Page } from "puppeteer-core";
import { ResilientBrowser } from "../../utils/resilientBrowser.ts";
import { setTimeout as delay } from "node:timers/promises";
import { extractJobData } from "./jobData.ts";
import { INSTAHYRE_URL_JOB_SEARCH, isBlacklistedCompany, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsAutoApplied, incrementJobsScraped } from "../../utils/automationState.ts";

async function safeClosePage(page: Page | null | undefined): Promise<void> {
  if (!page) return;
  try {
    if (!page.isClosed()) {
      await page.close();
    }
  } catch (err: any) {
    if (
      !err?.message?.includes("No target with given id found") &&
      !err?.message?.includes("Target closed")
    ) {
      console.warn("[Instahyre] Notice during page.close:", err.message);
    }
  }
}

async function isAnyModalOpen(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const modals = Array.from(
        document.querySelectorAll(
          ".modal, .modal-dialog, .application-modal-wrap, #application-modal, div[role='dialog']"
        )
      );
      return modals.some((m) => {
        const el = m as HTMLElement;
        const style = window.getComputedStyle(el);
        return (
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          (el.offsetWidth > 0 || el.offsetHeight > 0)
        );
      });
    });
  } catch (e) {
    return false;
  }
}

async function forceCloseModals(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      // 1. Remove backdrop elements
      const backdrops = document.querySelectorAll(".modal-backdrop");
      backdrops.forEach((b) => b.remove());

      // 2. Hide modals and remove 'in' / 'show' classes
      const modals = document.querySelectorAll(".modal, .application-modal-wrap, #application-modal");
      modals.forEach((m) => {
        const el = m as HTMLElement;
        el.classList.remove("in", "show");
        el.style.display = "none";
        el.setAttribute("aria-hidden", "true");
      });

      // 3. Remove modal-open class on body
      document.body.classList.remove("modal-open");
      document.body.style.removeProperty("padding-right");
      document.body.style.removeProperty("overflow");
    });
  } catch (e) {}
}

async function hasAlreadyNotInterestedBanner(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const text = (document.body.innerText || document.body.textContent || "").toLowerCase();
      return (
        text.includes("already marked this job as not interested") ||
        text.includes("marked this job as not interested")
      );
    });
  } catch (e) {
    return false;
  }
}

async function isModalShowingApplied(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const phrases = [
        "already applied",
        "you have applied",
        "you have already applied",
        "already marked this job as not interested",
        "marked this job as not interested",
        "application submitted",
        "applied successfully",
        "application received",
        "application sent",
        "already applied to this job"
      ];

      // 1. Check all visible modal containers
      const modals = Array.from(
        document.querySelectorAll(
          ".modal, .modal-dialog, .modal-content, [role='dialog'], .application-modal-wrap, #application-modal"
        )
      ).filter((m) => (m as HTMLElement).offsetWidth > 0 || (m as HTMLElement).offsetHeight > 0);

      for (const modal of modals) {
        const modalText = (modal.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
        if (phrases.some((p) => modalText.includes(p))) {
          return true;
        }

        const buttons = Array.from(modal.querySelectorAll("button, a, span"));
        for (const btn of buttons) {
          const txt = (btn.textContent || "").trim().toLowerCase();
          if (txt === "applied" || phrases.some((p) => txt.includes(p))) {
            return true;
          }
        }
      }

      // 2. Check primary apply button specifically
      const applyBtn = document.querySelector(".apply button, button.btn-primary.apply, .modal-footer button, #apply-btn");
      if (applyBtn) {
        const btnText = (applyBtn.textContent || "").trim().toLowerCase();
        if (btnText === "applied" || phrases.some((p) => btnText.includes(p))) {
          return true;
        }
      }

      // 3. Check body text
      const bodyText = (document.body.innerText || document.body.textContent || "").toLowerCase();
      if (
        bodyText.includes("already applied to this job") ||
        bodyText.includes("you have already applied") ||
        bodyText.includes("already marked this job as not interested")
      ) {
        return true;
      }

      return false;
    });
  } catch (e) {
    return false;
  }
}

async function handleInterferingModals(page: Page): Promise<boolean> {
  try {
    return await page.evaluate(() => {
      const modalWraps = Array.from(
        document.querySelectorAll(
          ".application-modal-wrap, .modal, .modal-dialog, [role='dialog'], .alert, .notification"
        )
      );

      for (const wrap of modalWraps) {
        const htmlWrap = wrap as HTMLElement;
        if (htmlWrap.offsetWidth <= 0 && htmlWrap.offsetHeight <= 0) continue;

        const text = (htmlWrap.textContent || "").toLowerCase();
        const isNonApplyModal =
          text.includes("follow us") ||
          text.includes("premium") ||
          text.includes("move your application to the top") ||
          text.includes("feedback") ||
          text.includes("survey") ||
          text.includes("rate your experience") ||
          text.includes("get noticed") ||
          text.includes("congratulations");

        if (isNonApplyModal) {
          // Look for close icon
          const closeBtn = htmlWrap.querySelector(
            ".close, button.close, span.close, a.close, .application-modal-close, .fa-close, [data-dismiss='modal']"
          ) as HTMLElement;
          if (closeBtn && (closeBtn.offsetWidth > 0 || closeBtn.offsetHeight > 0)) {
            closeBtn.click();
            return true;
          }

          // Look for action buttons: close, skip, continue, done, got it, no thanks, dismiss
          const buttons = Array.from(htmlWrap.querySelectorAll("button, a"));
          const dismissBtn = buttons.find((b) => {
            const t = (b.textContent || "").trim().toLowerCase();
            return (
              t === "skip" ||
              t === "close" ||
              t === "continue" ||
              t === "done" ||
              t === "got it" ||
              t === "no thanks" ||
              t === "dismiss"
            );
          }) as HTMLElement;
          if (dismissBtn) {
            dismissBtn.click();
            return true;
          }
        }
      }
      return false;
    });
  } catch (e) {
    return false;
  }
}

async function handleNoticePeriodAndQuestions(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      // 1. Select dropdowns (e.g. notice period)
      const selects = Array.from(document.querySelectorAll("select"));
      for (const sel of selects) {
        if (sel.selectedIndex <= 0 && sel.options.length > 1) {
          sel.selectedIndex = 1;
          sel.dispatchEvent(new Event("change", { bubbles: true }));
        }
      }

      // 2. Radio buttons (e.g. notice period, work auth)
      const radioGroups = new Set<string>();
      const radios = Array.from(document.querySelectorAll('input[type="radio"]')) as HTMLInputElement[];
      for (const r of radios) {
        if (r.name) radioGroups.add(r.name);
      }
      for (const groupName of radioGroups) {
        const groupRadios = radios.filter((r) => r.name === groupName);
        if (!groupRadios.some((r) => r.checked) && groupRadios[0]) {
          groupRadios[0].click();
        }
      }

      // 3. Required checkboxes
      const checkboxes = Array.from(document.querySelectorAll('input[type="checkbox"][required]')) as HTMLInputElement[];
      for (const cb of checkboxes) {
        if (!cb.checked) {
          cb.click();
        }
      }
    });
  } catch (e) {}
}

async function clickApplyButton(page: Page): Promise<boolean> {
  try {
    // 1. First handle any notice period or question inputs
    await handleNoticePeriodAndQuestions(page);
    await delay(300);

    return await page.evaluate(() => {
      // 2. Check primary apply/submit selectors
      const primarySelectors = [
        ".apply button",
        "button.btn-primary.apply",
        "#apply-btn",
        ".modal-footer button.btn-primary",
        ".modal-footer button[type='submit']",
        ".application-modal-wrap button.btn-primary",
        ".modal-dialog button.btn-primary",
        "button[type='submit']"
      ];

      for (const sel of primarySelectors) {
        const applyBtn = document.querySelector(sel) as HTMLElement;
        if (applyBtn && (applyBtn.offsetWidth > 0 || applyBtn.offsetHeight > 0)) {
          const txt = (applyBtn.innerText || applyBtn.textContent || "").trim().toLowerCase();
          if (txt === "close" || txt === "cancel" || txt === "skip") continue;
          applyBtn.click();
          return true;
        }
      }

      // 3. Check buttons by action text keywords
      const targetKeywords = [
        "apply",
        "apply now",
        "submit",
        "submit application",
        "send application",
        "send",
        "confirm",
        "proceed",
        "save & continue",
        "continue"
      ];

      const btns = Array.from(document.querySelectorAll("button, a.btn")) as HTMLElement[];
      for (const kw of targetKeywords) {
        const btn = btns.find((b) => {
          const t = (b.innerText || b.textContent || "").trim().toLowerCase();
          return t === kw;
        }) as HTMLElement;
        if (btn && (btn.offsetWidth > 0 || btn.offsetHeight > 0)) {
          btn.click();
          return true;
        }
      }

      return false;
    });
  } catch (e) {
    return false;
  }
}

async function dismissModalAndMoveAhead(page: Page): Promise<boolean> {
  try {
    const closed = await page.evaluate(() => {
      // 1. Close button selectors
      const closeSelectors = [
        ".close",
        "button.close",
        "span.close",
        "a.close",
        "div.close",
        ".application-modal-close",
        ".modal-header .close",
        ".modal-header button",
        ".modal-dialog .close",
        ".modal-content .close",
        ".modal-close",
        '[aria-label="Close"]',
        '[aria-label="close"]',
        '[data-dismiss="modal"]',
        'button[ng-click*="close"]',
        'button[ng-click*="dismiss"]',
        'button[ng-click*="cancel"]',
        'a[ng-click*="close"]',
        'a[ng-click*="dismiss"]',
        "i.fa-close",
        "i.fa-times",
        "svg[data-icon='close']",
        ".alert .close",
        ".notification .close"
      ];

      for (const sel of closeSelectors) {
        const elements = Array.from(document.querySelectorAll(sel));
        for (const el of elements) {
          const htmlEl = el as HTMLElement;
          if (htmlEl.offsetWidth > 0 || htmlEl.offsetHeight > 0) {
            htmlEl.click();
            return true;
          }
        }
      }

      // 2. Buttons with action text: close, skip, continue, done, dismiss, got it, cancel, no thanks
      const actionKeywords = [
        "close",
        "skip",
        "continue",
        "done",
        "got it",
        "dismiss",
        "no thanks",
        "cancel",
        "maybe later",
        "remind me later",
        "not now",
        "back"
      ];

      const allButtons = Array.from(
        document.querySelectorAll(
          ".modal button, .modal a, .application-modal-wrap button, .application-modal-wrap a, [role='dialog'] button, button.btn-secondary, button.btn-default"
        )
      );

      for (const btn of allButtons) {
        const htmlBtn = btn as HTMLElement;
        if (htmlBtn.offsetWidth > 0 || htmlBtn.offsetHeight > 0) {
          const txt = (htmlBtn.innerText || htmlBtn.textContent || "").trim().toLowerCase();
          // Never click Apply button when trying to dismiss
          if (txt === "apply" || txt.includes("apply now") || txt.includes("interested")) {
            continue;
          }
          if (actionKeywords.some((kw) => txt === kw || txt.startsWith(kw) || txt.includes(kw))) {
            htmlBtn.click();
            return true;
          }
        }
      }

      return false;
    });

    try {
      await page.keyboard.press("Escape");
    } catch (e) {}

    await delay(500);

    // If modal is still open, try clicking the backdrop
    const stillOpen = await isAnyModalOpen(page);
    if (stillOpen) {
      await page.evaluate(() => {
        const backdrop = document.querySelector(".modal-backdrop") as HTMLElement;
        if (backdrop) backdrop.click();
      });
      await delay(500);
    }

    return closed;
  } catch (e) {
    return false;
  }
}

async function handleAlreadyNotInterested(
  page: Page,
  companyName: string | null
): Promise<void> {
  console.log(
    `[Instahyre] Detected 'already marked this job as not interested' banner for ${
      companyName || "current job"
    }.`
  );
  console.log("[Instahyre] Considering job as applied & incrementing counters...");

  incrementJobsAutoApplied();
  incrementJobsScraped();

  console.log("[Instahyre] Hitting apply button again...");
  await clickApplyButton(page);
  await delay(WAIT_TIME);

  const stillSameJob = await page.evaluate((old) => {
    const applyBtnExists = !!document.querySelector(".apply button");
    if (!applyBtnExists) return false;
    if (!old) return true;
    const current = document.querySelector("h2.company-name")?.textContent?.trim();
    return current === old;
  }, companyName);

  if (stillSameJob) {
    console.log("[Instahyre] Job modal still open. Dismissing modal to move ahead...");
    await dismissModalAndMoveAhead(page);
    await delay(WAIT_TIME);
  } else {
    console.log("[Instahyre] Successfully moved ahead after re-hitting apply.");
  }
}

async function applyJobs(page: Page, onRestartNeeded?: () => Promise<void>): Promise<void> {
  let lastStuckCompany: string | null = null;
  let loopCount = 0;
  const MAX_LOOPS_PER_MODAL = 4;

  while (loopCount++ < MAX_LOOPS_PER_MODAL) {
    try {
      // 0. Dismiss any non-apply interfering modals (follow us, premium, feedback)
      await handleInterferingModals(page);

      // Check if modal is currently open
      if (!await isAnyModalOpen(page)) {
        break;
      }

      // 1. If job is already applied, dismiss modal and continue
      if (await isModalShowingApplied(page)) {
        console.log("[Instahyre] Modal indicates job is already applied.");
        const { companyName } = await extractJobData(page);
        console.log(`[Instahyre] Recording ${companyName || "job"} as auto-applied.`);
        incrementJobsAutoApplied();
        incrementJobsScraped();

        console.log("[Instahyre] Dismissing already-applied modal and moving ahead...");
        await dismissModalAndMoveAhead(page);
        await delay(WAIT_TIME);

        // Check if modal is still showing applied after dismiss attempt
        if (await isModalShowingApplied(page)) {
          console.log("[Instahyre] Modal still showing applied after first dismiss. Retrying dismiss...");
          await dismissModalAndMoveAhead(page);
          await delay(WAIT_TIME);

          if (await isModalShowingApplied(page)) {
            console.log("[Instahyre] Force closing stubborn applied modal...");
            await forceCloseModals(page);
            await delay(500);

            if (await isModalShowingApplied(page)) {
              console.log("[Instahyre] Unable to close modal. Requesting window restart...");
              if (onRestartNeeded) {
                await onRestartNeeded();
                return;
              }
              break;
            }
          }
        }
        console.log("[Instahyre] Successfully moved ahead after closing already-applied modal.");
        continue;
      }

      // 2. Check if the "already marked not interested" banner is displayed
      if (await hasAlreadyNotInterestedBanner(page)) {
        const { companyName } = await extractJobData(page);
        if (companyName && lastStuckCompany === companyName) {
          console.log("[Instahyre] Modal still stuck on same job. Dismissing to move ahead...");
          await dismissModalAndMoveAhead(page);
          break;
        }
        lastStuckCompany = companyName;
        await handleAlreadyNotInterested(page, companyName);
        continue;
      }

      const { companyName, isAlreadyProcessed } = await extractJobData(page);
      const isBlacklisted = companyName ? isBlacklistedCompany(companyName) : false;

      // 3. Skip if already processed or blacklisted
      if (isAlreadyProcessed || isBlacklisted) {
        if (await hasAlreadyNotInterestedBanner(page)) {
          if (companyName && lastStuckCompany === companyName) {
            await dismissModalAndMoveAhead(page);
            break;
          }
          lastStuckCompany = companyName;
          await handleAlreadyNotInterested(page, companyName);
          continue;
        }

        const skipped = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll("button"));
          const skipBtn = btns.find((b) => {
            const text = (b.innerText || "").toLowerCase().trim();
            return (
              text.includes("not interested") ||
              text.includes("no thanks") ||
              text.includes("decline") ||
              text.includes("skip")
            );
          });
          if (skipBtn) {
            skipBtn.click();
            return true;
          }
          return false;
        });

        await delay(1000);

        if (await hasAlreadyNotInterestedBanner(page)) {
          if (companyName && lastStuckCompany === companyName) {
            await dismissModalAndMoveAhead(page);
            break;
          }
          lastStuckCompany = companyName;
          await handleAlreadyNotInterested(page, companyName);
          continue;
        }

        if (!skipped) {
          console.log("[Instahyre] Could not find skip/decline button. Dismissing modal...");
          await dismissModalAndMoveAhead(page);
          break;
        }

        await delay(WAIT_TIME);
        continue;
      }

      // 4. Click Apply / Submit Button
      if (companyName) {
        await clickApplyButton(page);
        await delay(WAIT_TIME);

        // Check if banner or already applied message appeared after clicking
        if (await isModalShowingApplied(page)) {
          console.log(`[Instahyre] Application confirmed for ${companyName}.`);
          incrementJobsAutoApplied();
          incrementJobsScraped();
          await dismissModalAndMoveAhead(page);
          continue;
        }

        if (await hasAlreadyNotInterestedBanner(page)) {
          if (companyName && lastStuckCompany === companyName) {
            await dismissModalAndMoveAhead(page);
            break;
          }
          lastStuckCompany = companyName;
          await handleAlreadyNotInterested(page, companyName);
          continue;
        }

        // Dismiss any popup that appeared after applying (e.g. follow us / premium)
        await handleInterferingModals(page);
        await delay(500);

        const isSuccess = await page.evaluate((oldName) => {
          const currentName = document.querySelector("h2.company-name")?.textContent?.trim();
          const applyBtnExists = !!document.querySelector(".apply button, #apply-btn");
          return !applyBtnExists || currentName !== oldName;
        }, companyName);

        if (isSuccess) {
          incrementJobsAutoApplied();
          incrementJobsScraped();
        } else {
          // If not transitioned, check if it says applied now
          if (await isModalShowingApplied(page)) {
            incrementJobsAutoApplied();
            incrementJobsScraped();
            await dismissModalAndMoveAhead(page);
            continue;
          }
          // Dismiss modal to avoid getting stuck
          await dismissModalAndMoveAhead(page);
        }
      } else {
        await dismissModalAndMoveAhead(page);
        break;
      }
    } catch (error) {
      console.error("[Instahyre] Error in applyJobs loop:", error);
      break;
    }
  }

  // Final check: Guarantee no modal remains open after applyJobs finishes
  if (await isAnyModalOpen(page)) {
    console.log("[Instahyre] Modal still lingering after applyJobs loop. Dismissing...");
    await dismissModalAndMoveAhead(page);
    await delay(500);
    if (await isAnyModalOpen(page)) {
      console.log("[Instahyre] Force closing lingering modal...");
      await forceCloseModals(page);
    }
  }
}

async function processAllVisibleJobs(page: Page, onRestartNeeded?: () => Promise<void>) {
  let consecutiveNoJobs = 0;
  while (consecutiveNoJobs < 2) {
    // 1. Dismiss any interfering modal before searching for job cards
    await handleInterferingModals(page);

    // 2. Ensure no lingering modal is covering the job list
    if (await isAnyModalOpen(page)) {
      await dismissModalAndMoveAhead(page);
      await delay(500);
      if (await isAnyModalOpen(page)) {
        await forceCloseModals(page);
      }
    }

    let clicked = false;
    try {
      clicked = await page.evaluate(() => {
        const btns = Array.from(
          document.querySelectorAll(".btn-interested")
        ) as HTMLElement[];
        const visibleBtn = btns.find(
          (b) => b.offsetWidth > 0 && b.offsetHeight > 0 && !b.hasAttribute("data-clicked")
        );
        if (visibleBtn) {
          visibleBtn.scrollIntoView({ behavior: "instant", block: "center" });
          visibleBtn.click();
          visibleBtn.setAttribute("data-clicked", "true");
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

    // 3. Wait up to 4s for modal to actually open
    let modalOpened = false;
    for (let m = 0; m < 8; m++) {
      await delay(500);
      modalOpened = await isAnyModalOpen(page);
      if (modalOpened) break;
    }

    if (modalOpened) {
      await applyJobs(page, onRestartNeeded);
    }

    // 4. Ensure no modal stays open before next iteration
    if (await isAnyModalOpen(page)) {
      await forceCloseModals(page);
      await delay(300);
      if (await isAnyModalOpen(page)) {
        console.log("[Instahyre] Modal completely stuck between jobs. Reloading page...");
        await page.reload({ waitUntil: "domcontentloaded" });
        await delay(WAIT_TIME);
      }
    }

    await delay(WAIT_TIME);
  }
}

export default async function instahyer(resilientBrowser: ResilientBrowser): Promise<void> {
  const MAX_RESTARTS = 3;
  let restarts = 0;

  while (restarts < MAX_RESTARTS) {
    let page: Page | null = null;
    let shouldRestart = false;

    try {
      page = await resilientBrowser.newPage();

      const onRestartNeeded = async () => {
        shouldRestart = true;
      };

      await page.goto(INSTAHYRE_URL_JOB_SEARCH, { waitUntil: "load" });
      await delay(WAIT_TIME);

      // 1. Process visible jobs on root page
      try {
        await processAllVisibleJobs(page, onRestartNeeded);
      } catch (error) {
        console.error("[Instahyre] Failed to apply on root page", error);
      }

      if (shouldRestart) {
        console.log(`[Instahyre] Stuck modal restart requested. Restarting entire Instahyre session (${restarts + 1}/${MAX_RESTARTS})...`);
        restarts++;
        await safeClosePage(page);
        page = null;
        await delay(WAIT_TIME);
        continue;
      }

      // 2. Click 'dk' saved search
      const clickedDk = await page.evaluate(() => {
        const searchNames = Array.from(
          document.querySelectorAll(".saved-search-name, span, div.ng-binding, a")
        );
        const dkElement = searchNames.find(
          (el) => el.textContent?.trim().toLowerCase() === "dk"
        );

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
          await processAllVisibleJobs(page, onRestartNeeded);
        } catch (e) {
          console.log("[Instahyre] No jobs found in dk search.");
        }

        if (shouldRestart) {
          console.log(`[Instahyre] Stuck modal restart requested in dk search. Restarting session (${restarts + 1}/${MAX_RESTARTS})...`);
          restarts++;
          await safeClosePage(page);
          page = null;
          await delay(WAIT_TIME);
          continue;
        }
      }

      // Completed successfully without restart request
      break;
    } catch (err: any) {
      console.error("[Instahyre] Error during session:", err?.message || err);
      restarts++;
      if (restarts < MAX_RESTARTS) {
        console.log(`[Instahyre] Retrying Instahyre session (${restarts}/${MAX_RESTARTS})...`);
        await delay(WAIT_TIME);
      } else {
        break;
      }
    } finally {
      await safeClosePage(page);
      page = null;
    }
  }
}
