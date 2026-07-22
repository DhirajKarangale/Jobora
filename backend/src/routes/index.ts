import { Router } from "express";
import { getProcessStatus, startProcess } from "./process.ts";
import { getEligibleJobs, toggleJobApplied } from "./eligibleJobs.ts";

const router = Router();

router.get("/process/status", getProcessStatus);
router.post("/process/start", startProcess);
router.get("/jobs/eligible", getEligibleJobs);
router.post("/jobs/apply", toggleJobApplied);

export default router;
