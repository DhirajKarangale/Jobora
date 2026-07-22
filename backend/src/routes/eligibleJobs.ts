import { type Request, type Response } from "express";
import { fetchAndAckEligibleJobIds, deleteJobFromEligibleStream, addJobToEligibleStream } from "../cloud/redis/index.ts";
import { getJobsByIds, setJobAppliedStatus, getJobIdentifiers } from "../cloud/db/index.ts";

export async function getEligibleJobs(_req: Request, res: Response): Promise<void> {
  try {
    const jobIds = await fetchAndAckEligibleJobIds();

    console.log(`Got ${jobIds.length} items from job redis stream`);

    if (jobIds.length === 0) {
      res.json(null);
      return;
    }

    const jobs = await getJobsByIds(jobIds);

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

    // 1. Update DB isapplied status
    await setJobAppliedStatus(jobId, isApplied);

    // Get all matching identifiers (UUID, source_jobid, etc.)
    const identifiers = await getJobIdentifiers(jobId);

    if (isApplied) {
      // 2a. Delete job from REDIS_CONSUMER_ELIGIBLE stream
      await deleteJobFromEligibleStream(identifiers);
      console.log(`Job ${jobId} (identifiers: ${identifiers.join(",")}) marked as APPLIED (removed from Redis stream)`);
    } else {
      // 2b. Add job back into REDIS_CONSUMER_ELIGIBLE stream
      await addJobToEligibleStream(jobId);
      console.log(`Job ${jobId} marked as NOT APPLIED (added back to Redis stream)`);
    }

    res.json({ success: true, jobId, isApplied });
  } catch (error) {
    console.error("Error toggling job applied status:", error);
    res.status(500).json({ error: "Failed to toggle job applied status" });
  }
}
