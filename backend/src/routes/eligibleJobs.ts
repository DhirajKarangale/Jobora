import { type Request, type Response } from "express";
import { setJobAppliedStatus, getAllEligibleJobs } from "../cloud/db/index.ts";

export async function getEligibleJobs(_req: Request, res: Response): Promise<void> {
  try {
    const jobs = await getAllEligibleJobs();

    console.log(`Got ${jobs.length} eligible jobs from DB`);

    if (jobs.length === 0) {
      res.json(null);
      return;
    }

    res.json(jobs);
  } catch (error) {
    console.error("Error fetching eligible jobs:", error);
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

    // Update DB isapplied status
    await setJobAppliedStatus(jobId, isApplied);
    console.log(`Job ${jobId} marked as ${isApplied ? "APPLIED" : "NOT APPLIED"}`);

    res.json({ success: true, jobId, isApplied });
  } catch (error) {
    console.error("Error toggling job applied status:", error);
    res.status(500).json({ error: "Failed to toggle job applied status" });
  }
}
