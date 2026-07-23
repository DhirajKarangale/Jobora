import { Router } from "express";
import { getAutomationStatus, startJobScraping, startInstahyreAutoApply } from "./automation.ts";
import { getEligibleJobs, toggleJobApplied, toggleJobExpired } from "./eligibleJobs.ts";
import { getAnalytics, getFilterOptionsHandler } from "./analytics.ts";

const router = Router();

router.get("/automation/status", getAutomationStatus);
router.post("/automation/scraper/start", startJobScraping);
router.post("/automation/auto-apply/start", startInstahyreAutoApply);
router.get("/jobs/eligible", getEligibleJobs);
router.post("/jobs/apply", toggleJobApplied);
router.post("/jobs/expired", toggleJobExpired);
router.get("/analytics", getAnalytics);
router.get("/analytics/filters", getFilterOptionsHandler);

export default router;
