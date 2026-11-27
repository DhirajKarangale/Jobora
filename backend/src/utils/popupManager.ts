import { type Browser, type Page, type Target } from "puppeteer-core";
import { ResilientBrowser } from "./resilientBrowser.ts";
import { setTimeout as delay } from "node:timers/promises";

/**
 * Known job portal domains that must NEVER be closed as external popups.
 */
const PROTECTED_PORTAL_DOMAINS = [
  "linkedin.com",
  "naukri.com",
  "wellfound.com",
  "instahyre.com",
  "cutshort.io"
];

function isProtectedPortalPage(url: string | null | undefined): boolean {
  if (!url || url === "about:blank") return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return PROTECTED_PORTAL_DOMAINS.some(domain => host === domain || host.endsWith("." + domain));
  } catch {
    return false;
  }
}

/**
 * Returns the underlying raw Puppeteer Browser instance.
 */
export async function getRawBrowser(browser: Browser | ResilientBrowser): Promise<Browser> {
  if (browser instanceof ResilientBrowser) {
    return await browser.getBrowser();
  }
  return browser;
}

/**
 * Safely closes a Puppeteer Page without throwing unhandled exceptions if
 * the target is already closed, detached, or unavailable.
 */
export async function safeClosePage(page: Page | null | undefined): Promise<void> {
  if (!page) return;
  try {
    if (!page.isClosed()) {
      await page.close();
    }
  } catch (err: any) {
    if (
      !err?.message?.includes("detached") &&
      !err?.message?.includes("Target closed") &&
      !err?.message?.includes("No target with given id found") &&
      !err?.message?.includes("Session closed")
    ) {
      console.warn("[PopupManager] safeClosePage error:", err.message);
    }
  }
}

/**
 * Executes a click on an "apply on site" button, catches the newly opened
 * external company site window/tab, captures its URL, and closes ONLY that
 * specific external window/tab. Never touches the main portal page or any
 * other open browser windows.
 */
export async function trackAndClosePopups(
  browser: Browser | ResilientBrowser,
  mainPage: Page,
  action: () => Promise<void>,
  options?: { timeoutMs?: number; settleDelayMs?: number }
): Promise<{ openedNewTab: boolean; finalUrl: string | null; urls: string[] }> {
  const settleDelayMs = options?.settleDelayMs ?? 2000;
  const rawBrowser = await getRawBrowser(browser);

  // 1. Snapshot existing pages before the action so we never touch them
  let beforePages: Set<Page> = new Set();
  try {
    const pages = await rawBrowser.pages();
    beforePages = new Set(pages);
  } catch {}

  // 2. Register targetcreated listener to detect the new tab for the external site
  const newlyCreatedTargets: Target[] = [];
  const targetListener = (target: Target) => {
    if (target.type() === "page") {
      newlyCreatedTargets.push(target);
    }
  };

  rawBrowser.on("targetcreated", targetListener);

  try {
    // 3. Perform the apply on site click action
    await action();

    // 4. Wait briefly for the external company site window/tab to open and settle URL
    await delay(settleDelayMs);
  } catch (actionErr) {
    console.warn("[PopupManager] Action error during popup tracking:", actionErr);
  } finally {
    rawBrowser.off("targetcreated", targetListener);
  }

  // 5. Identify ONLY the newly opened popup pages from this action
  const popupPages: Page[] = [];
  try {
    const afterPages = await rawBrowser.pages();
    for (const p of afterPages) {
      if (!beforePages.has(p) && p !== mainPage && !p.isClosed()) {
        popupPages.push(p);
      }
    }

    for (const target of newlyCreatedTargets) {
      try {
        const p = await target.page();
        if (p && p !== mainPage && !popupPages.includes(p) && !p.isClosed()) {
          popupPages.push(p);
        }
      } catch {}
    }
  } catch (gatherErr) {
    console.warn("[PopupManager] Error identifying popup pages:", gatherErr);
  }

  const urls: string[] = [];
  let finalUrl: string | null = null;

  // 6. Close ONLY the external company site tabs that were opened by apply on site
  for (const popup of popupPages) {
    try {
      let u = popup.url();
      if (!u || u === "about:blank") {
        await delay(1000);
        u = popup.url();
      }

      // Safeguard: Never close a portal page (e.g. if another concurrent portal created a tab)
      if (isProtectedPortalPage(u)) {
        console.log(`[PopupManager] Preserving portal page: ${u}`);
        continue;
      }

      if (u && u !== "about:blank") {
        urls.push(u);
        if (!finalUrl) finalUrl = u;
      }

      console.log(`[PopupManager] Closing external company site window opened by apply on site: ${u || 'external popup'}`);
      await safeClosePage(popup);
    } catch {}
  }

  return {
    openedNewTab: popupPages.length > 0,
    finalUrl,
    urls
  };
}
