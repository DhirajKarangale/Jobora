import { type Browser, type Page } from "puppeteer-core";
import { edge } from "./browserManager.ts";

/**
 * A wrapper around Puppeteer's Browser that automatically reconnects
 * if the browser gets disconnected mid-work. All portals should use
 * `getBrowser()` and `newPage()` from this class instead of accessing
 * the raw Browser directly.
 */
export class ResilientBrowser {
  private browser: Browser;
  private portalName: string;

  constructor(browser: Browser, portalName: string) {
    this.browser = browser;
    this.portalName = portalName;
  }

  /** Returns a connected browser, restarting it if disconnected. */
  async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    console.log(`[${this.portalName}] Browser disconnected. Restarting...`);
    this.browser = await edge();
    console.log(`[${this.portalName}] Browser restarted successfully.`);
    return this.browser;
  }

  /** Opens a new page, restarting the browser first if needed. */
  async newPage(): Promise<Page> {
    const browser = await this.getBrowser();
    return browser.newPage();
  }

  /** Returns all open pages, restarting the browser first if needed. */
  async pages(): Promise<Page[]> {
    const browser = await this.getBrowser();
    return browser.pages();
  }

  /** Check if browser is currently connected. */
  get connected(): boolean {
    return this.browser && this.browser.connected;
  }

  /** Get the raw browser (for rare cases like checking page handles). */
  get raw(): Browser {
    return this.browser;
  }
}
