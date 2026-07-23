import { type Request, type Response } from "express";
import { edge, closeBrowser } from "../utils/browserManager.ts";
import linkedin from "../portals/linkedin/index.ts";

let isProcessRunning = false;

export async function getProcessStatus(_req: Request, res: Response): Promise<void> {
  res.json(isProcessRunning);
}

export async function startProcess(_req: Request, res: Response): Promise<void> {
  if (isProcessRunning) {
    res.json(true);
    return;
  }

  isProcessRunning = true;

  (async () => {
    let browser;
    try {
      browser = await edge();
      await linkedin(browser);
    } catch (error) {
    } finally {
      if (browser) {
        try {
          await closeBrowser(browser);
        } catch {
        }
      }
      isProcessRunning = false;
    }
  })();

  res.json(true);
}
