import { Router } from "express";
import { getProcessStatus, startProcess } from "./process.ts";
import { getEligibleJobs, toggleJobApplied } from "./eligibleJobs.ts";
import { getAnalytics, getFilterOptionsHandler } from "./analytics.ts";

const router = Router();

router.get("/process/status", getProcessStatus);
router.post("/process/start", startProcess);
router.get("/jobs/eligible", getEligibleJobs);
router.post("/jobs/apply", toggleJobApplied);
router.get("/analytics", getAnalytics);
router.get("/analytics/filters", getFilterOptionsHandler);

export default router;
