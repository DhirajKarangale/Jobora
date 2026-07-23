import { type Request, type Response } from "express";
import { setJobAppliedStatus, getAllEligibleJobs } from "../cloud/db/index.ts";

export async function getEligibleJobs(_req: Request, res: Response): Promise<void> {
  try {
    const jobs = await getAllEligibleJobs();

    if (jobs.length === 0) {
      res.json(null);
      return;
    }

    res.json(jobs);
  } catch (error) {
    res.json(null);
  }
}

export async function toggleJobApplied(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, isApplied } = req.body;
    if (!jobId || typeof isApplied !== "boolean") {
      res.status(400).json({ error: "Missing jobId or isApplied boolean" });
      return;
    }

    await setJobAppliedStatus(jobId, isApplied);

    res.json({ success: true, jobId, isApplied });
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle job applied status" });
  }
}

export async function toggleJobExpired(req: Request, res: Response): Promise<void> {
  try {
    const { jobId, isExpired } = req.body;
    if (!jobId || typeof isExpired !== "boolean") {
      res.status(400).json({ error: "Missing jobId or isExpired boolean" });
      return;
    }

    // Need to import setJobExpiredStatus at the top
    const { setJobExpiredStatus } = await import("../cloud/db/index.ts");
    await setJobExpiredStatus(jobId, isExpired);

    res.json({ success: true, jobId, isExpired });
  } catch (error) {
    res.status(500).json({ error: "Failed to toggle job expired status" });
  }
}
