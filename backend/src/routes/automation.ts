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
import { redis, connectRedis } from "../cloud/redis/config.ts";
import { addToProcessStream } from "../cloud/redis/index.ts";
import { getJobsByIds, setJobsIneligibleStatus, setJobAppliedFromPending, resetPendingJobStatus } from "../cloud/db/index.ts";

const GLOBAL_STREAM_KEY = process.env.REDIS_CONSUMER_PROCESS;

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
    const p = Promise.resolve().then(() => task()).catch(err => {
      console.error("Task execution failed:", err);
    });
    executing.add(p);

    const clean = () => executing.delete(p);
    p.then(clean);

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
        async () => { try { await linkedin(browser); } catch(e) { console.error("LinkedIn error:", e); } },
        async () => { try { await instahyre(browser); } catch(e) { console.error("Instahyre error:", e); } },
        async () => { try { await wellfound(browser); } catch(e) { console.error("Wellfound error:", e); } },
        async () => { try { await cutshort(browser); } catch(e) { console.error("Cutshort error:", e); } },
        async () => { try { await naukri(browser); } catch(e) { console.error("Naukri error:", e); } },
      ];
      await runWithConcurrency(portals, MAX_CONCURRENT_PORTALS);
    } catch (error) {
      console.error("Global automation error:", error);
    } finally {
      setProcessStarted(false);
      if (globalBrowser) {
        await globalBrowser.close();
        globalBrowser = null;
      }
    }
  })();
}

export async function stopAutomationProcess(_req: Request, res: Response): Promise<void> {
  setProcessStarted(false);
  if (globalBrowser) {
    try {
      await globalBrowser.close();
    } catch (e) {
      // ignore
    }
    globalBrowser = null;
  }
  res.json({ success: true, message: "Automation stopped" });
}

export async function getPendingJobs(_req: Request, res: Response): Promise<void> {
  try {
    await connectRedis();
    if (!GLOBAL_STREAM_KEY) {
      res.json([]);
      return;
    }
    const items = await redis.xrange(GLOBAL_STREAM_KEY, '-', '+') as any[];

    if (items.length === 0) {
      res.json([]);
      return;
    }

    const dbIdMap = new Map<string, string>();

    for (const item of items) {
      const messageId = item[0];
      const fields = item[1];
      for (let i = 0; i < fields.length; i += 2) {
        if (fields[i] === 'id') {
          dbIdMap.set(messageId, fields[i + 1]);
          break;
        }
      }
    }

    const dbIds = Array.from(dbIdMap.values());
    const jobsData = await getJobsByIds(dbIds);

    const results = [];
    for (const [messageId, dbId] of dbIdMap.entries()) {
      const jobDbData = jobsData.find(j => String(j.id) === dbId);
      if (jobDbData) {
        results.push({
          messageId,
          dbId,
          role: jobDbData.role || "Unknown Role",
          companyName: jobDbData.company || "Unknown Company",
          sourceName: jobDbData.source || "Unknown Portal",
          link: jobDbData.link || null,
          portalLink: jobDbData.portal_link || null
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error("Error in getPendingJobs:", error);
    res.status(500).json({ error: "Failed to fetch pending jobs", details: String(error) });
  }
}

export async function removePendingJob(req: Request, res: Response): Promise<void> {
  try {
    const messageId = String(req.params.messageId);
    const { dbId } = req.body;

    if (!messageId || !dbId || !GLOBAL_STREAM_KEY) {
      res.status(400).json({ error: "Missing required parameters" });
      return;
    }

    await connectRedis();
    await redis.xdel(GLOBAL_STREAM_KEY, messageId);
    await setJobsIneligibleStatus([dbId]);

    res.json({ success: true, messageId });
  } catch (error) {
    res.status(500).json({ error: "Failed to remove pending job" });
  }
}

export async function markPendingJobApplied(req: Request, res: Response): Promise<void> {
  try {
    const messageId = String(req.params.messageId);
    const { dbId } = req.body;

    if (!messageId || !dbId || !GLOBAL_STREAM_KEY) {
      res.status(400).json({ error: "Missing required parameters" });
      return;
    }

    await connectRedis();
    await redis.xdel(GLOBAL_STREAM_KEY, messageId);
    await setJobAppliedFromPending(dbId);

    res.json({ success: true, messageId });
  } catch (error) {
    res.status(500).json({ error: "Failed to mark pending job as applied" });
  }
}

export async function clearAllPendingJobs(_req: Request, res: Response): Promise<void> {
  try {
    await connectRedis();
    if (!GLOBAL_STREAM_KEY) {
      res.status(400).json({ error: "No stream key configured" });
      return;
    }

    const items = await redis.xrange(GLOBAL_STREAM_KEY, '-', '+') as any[];

    if (items.length > 0) {
      const dbIds: string[] = [];
      for (const item of items) {
        const fields = item[1];
        for (let i = 0; i < fields.length; i += 2) {
          if (fields[i] === 'id') {
            dbIds.push(fields[i + 1]);
            break;
          }
        }
      }

      if (dbIds.length > 0) {
        await setJobsIneligibleStatus(dbIds);
      }
    }

    await redis.del(GLOBAL_STREAM_KEY);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to clear pending jobs" });
  }
}

export async function undoPendingJob(req: Request, res: Response): Promise<void> {
  try {
    const { dbId } = req.body;

    if (!dbId || !GLOBAL_STREAM_KEY) {
      res.status(400).json({ error: "Missing required parameters" });
      return;
    }

    await resetPendingJobStatus(dbId);
    const newMessageId = await addToProcessStream({ id: dbId });

    res.json({ success: true, messageId: newMessageId, dbId });
  } catch (error) {
    console.error("Error in undoPendingJob:", error);
    res.status(500).json({ error: "Failed to undo pending job action" });
  }
}
