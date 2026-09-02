import { type Browser } from "puppeteer-core";
import { getJobIds } from "./jobIds.ts";
import { getJobData } from "./jobData.ts";
import { LINKEDIN_URL_JOB_SEARCH, LINKEDIN_URL_JOB_SEARCH_EASY_APPLY } from "../../utils/constants.ts";

export default async function linkedin(browser: Browser): Promise<void> {
  console.log("Starting LinkedIn Pipelines in parallel...");

  const autoApplyPipeline = async () => {
    try {
      console.log("Started LinkedIn Auto Apply Pipeline...");
      const autoJobIds = await getJobIds(browser, LINKEDIN_URL_JOB_SEARCH_EASY_APPLY);
      await getJobData(browser, autoJobIds);
      console.log("Finished LinkedIn Auto Apply Pipeline.");
    } catch (e) {
      console.error("Error in LinkedIn Auto Apply Pipeline:", e);
    }
  };

  const manualApplyPipeline = async () => {
    try {
      console.log("Started LinkedIn Manual Apply (Website) Pipeline...");
      const manualJobIds = await getJobIds(browser, LINKEDIN_URL_JOB_SEARCH);
      await getJobData(browser, manualJobIds);
      console.log("Finished LinkedIn Manual Apply Pipeline.");
    } catch (e) {
      console.error("Error in LinkedIn Manual Apply Pipeline:", e);
    }
  };

  await Promise.all([
    autoApplyPipeline(),
    manualApplyPipeline()
  ]);
}
