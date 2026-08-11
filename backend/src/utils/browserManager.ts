import { WAIT_TIME } from "./constants.ts";
import puppeteer, { type Browser } from "puppeteer-core";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const EDGE_PATH = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";

export async function edge() {
  spawn(
    EDGE_PATH,
    [
      "--remote-debugging-port=9222",
      "--user-data-dir=C:\\temp\\edge-debug-profile",
    ],
    {
      detached: true,
      stdio: "ignore",
    }
  ).unref();

  await delay(WAIT_TIME);

  const browser = await puppeteer.connect({
    browserURL: "http://127.0.0.1:9222",
    protocolTimeout: 1200000,
  });

  return browser;
}

export async function closeBrowser(browser: Browser): Promise<void> {
  // await browser.close();
}