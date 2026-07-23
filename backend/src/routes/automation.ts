import { type Request, type Response } from "express";
import { type Browser } from "puppeteer-core";
import { edge } from "../utils/browserManager.ts";
import linkedin from "../job_portals/linkedin/index.ts";
import instahyre from "../job_portals/instahyre/index.ts";

let isJobScraperRunning = false;
let isAutoApplyRunning = false;
let globalBrowser: Browser | null = null;

async function getGlobalBrowser(): Promise<Browser> {
  if (globalBrowser && globalBrowser.connected) {
    return globalBrowser;
  }

  globalBrowser = await edge();

  globalBrowser.on('disconnected', () => {
    globalBrowser = null;
  });

  return globalBrowser;
}

export async function getAutomationStatus(_req: Request, res: Response): Promise<void> {
  res.json({
    isJobScraperRunning,
    isAutoApplyRunning
  });
}

export async function startJobScraping(_req: Request, res: Response): Promise<void> {
  if (isJobScraperRunning) {
    res.json(true);
    return;
  }

  isJobScraperRunning = true;

  (async () => {
    try {
      const browser = await getGlobalBrowser();
      const linkedinJobs = await linkedin(browser);
      res.json({ linkedinJobs });
    } catch (error) {
      console.error("LinkedIn process failed:", error);
      res.json(0);
    } finally {
      isJobScraperRunning = false;
    }
  })();
}

export async function startInstahyreAutoApply(_req: Request, res: Response): Promise<void> {
  if (isAutoApplyRunning) {
    res.status(400).json({ error: "Instahyre auto-apply process is already running" });
    return;
  }

  isAutoApplyRunning = true;

  try {
    const browser = await getGlobalBrowser();
    const jobsApplied = await instahyre(browser);
    res.json({ jobsApplied });
  } catch (error) {
    console.error("Instahyre process failed:", error);
    res.status(500).json({ error: "Failed to run Instahyre process" });
  } finally {
    isAutoApplyRunning = false;
  }
}
