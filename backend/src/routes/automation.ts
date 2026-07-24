import { type Request, type Response } from "express";
import { type Browser } from "puppeteer-core";
import { edge } from "../utils/browserManager.ts";
import linkedin from "../job_portals/linkedin/index.ts";
import instahyre from "../job_portals/instahyre/index.ts";
import wellfound from "../job_portals/wellfound/index.ts";
import naukri from "../job_portals/naukri/index.ts";
import cutshort from "../job_portals/cutshort/index.ts";
import { getProcessState, resetProcessState, setProcessStarted } from "../utils/automationState.ts";
import { MAX_CONCURRENT_PORTALS } from "../utils/constants.ts";

let globalBrowser: Browser | null = null;

async function getGlobalBrowser(): Promise<Browser> {
  if (globalBrowser && globalBrowser.connected) return globalBrowser;
  globalBrowser = await edge();
  globalBrowser.on('disconnected', () => { globalBrowser = null; });
  return globalBrowser;
}

export async function getAutomationStatus(_req: Request, res: Response): Promise<void> {
  res.json(getProcessState());
}

async function runWithConcurrency(tasks: (() => Promise<void>)[], concurrencyLimit: number) {
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const p = Promise.resolve().then(() => task());
    executing.add(p);

    const clean = () => executing.delete(p);
    p.then(clean).catch(clean);

    if (executing.size >= concurrencyLimit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);
}

export async function startAutomationProcess(_req: Request, res: Response): Promise<void> {
  const currentState = getProcessState();
  if (currentState.isRunning) {
    res.json({ ...currentState, success: true, message: "Already running" });
    return;
  }

  resetProcessState();
  res.json({ success: true, message: "Automation started" });

  (async () => {
    try {
      const browser = await getGlobalBrowser();

      const portals = [
        // async () => { await linkedin(browser); },
        // async () => { await instahyre(browser); },
        async () => { await wellfound(browser); },
        async () => { await cutshort(browser); },
        // async () => { await naukri(browser); }
      ];
      await runWithConcurrency(portals, MAX_CONCURRENT_PORTALS);
    } catch (error) {
    } finally {
      setProcessStarted(false);
    }
  })();
}
