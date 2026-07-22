import { type Request, type Response } from "express";
import { fetchAndAckEligibleJobIds } from "../cloud/redis/index.ts";
import { getJobsByIds } from "../cloud/db/index.ts";

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
