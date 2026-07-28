import { Router } from "express";
import { getAutomationStatus, startAutomationProcess, stopAutomationProcess, getPendingJobs, removePendingJob, clearAllPendingJobs, markPendingJobApplied } from "./automation.ts";
import { getEligibleJobs, toggleJobApplied, toggleJobExpired } from "./eligibleJobs.ts";
import { getAnalytics, getFilterOptionsHandler } from "./analytics.ts";

const router = Router();

router.get("/automation/status", getAutomationStatus);
router.post("/automation/start", startAutomationProcess);
router.post("/automation/stop", stopAutomationProcess);
router.get("/automation/pending-jobs", getPendingJobs);
router.delete("/automation/pending-jobs/clear", clearAllPendingJobs);
router.delete("/automation/pending-jobs/:messageId", removePendingJob);
router.post("/automation/pending-jobs/:messageId/apply", markPendingJobApplied);
router.get("/jobs/eligible", getEligibleJobs);
router.post("/jobs/apply", toggleJobApplied);
router.post("/jobs/expired", toggleJobExpired);
router.get("/analytics", getAnalytics);
router.get("/analytics/filters", getFilterOptionsHandler);

export default router;
