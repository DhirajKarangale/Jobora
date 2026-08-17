import { type Page } from "puppeteer-core";
import { DataJob } from "../../utils/constants.ts";
import { saveEligibleAndAppliedJob, isJobExisting } from "../../cloud/db/index.ts";

export async function extractJobData(page: Page): Promise<{ companyName: string | null; isAlreadyProcessed?: boolean }> {
  try {
    const data = await page.evaluate(() => {
      const companyName = document.querySelector("h2.company-name")?.textContent?.trim() || null;

      const locationIcon = document.querySelector("i.fa-map-marker");
      const location = locationIcon?.parentElement?.textContent?.trim() || null;
      const experience = document.querySelector(".experience")?.textContent?.trim() || null;
      const role = document.querySelector("h1")?.textContent?.trim() || null;
      const description = document.querySelector("div.profile-content.job-description")?.textContent?.trim() || null;
      const companyLink = (document.querySelector("a#employer-website") as HTMLAnchorElement)?.href || null;

      const oppId = document.querySelector("[data-job-id]")?.getAttribute("data-job-id")
        || document.querySelector("[id^='opportunity-']")?.id?.replace("opportunity-", "")
        || (companyName && role ? `instahyre-${companyName}-${role}`.toLowerCase().replace(/[^a-z0-9]/g, "-") : "");

      return {
        companyName,
        location,
        experience,
        role,
        description,
        companyLink,
        opportunityId: oppId
      };
    });

    if (!data.companyName) return { companyName: '', isAlreadyProcessed: false };

    const cleanJobId = data.opportunityId ? data.opportunityId.trim().toLowerCase() : "";
    if (cleanJobId && await isJobExisting(cleanJobId)) {
      return { companyName: data.companyName, isAlreadyProcessed: true };
    }

    const fullDescription = [
      data.experience ? `Experience: ${data.experience}` : "",
      data.location ? `Location: ${data.location}` : "",
      data.description || ""
    ].filter(Boolean).join("\n\n");

    const jobData: DataJob = {
      id: null,
      sourceName: "Instahyre",
      sourceJobId: cleanJobId,
      companyName: data.companyName,
      jobId: cleanJobId,
      description: fullDescription,
      link: data.companyLink || "",
      portal_link: null,
      role: data.role
    };

    await saveEligibleAndAppliedJob(jobData);
    return { companyName: data.companyName, isAlreadyProcessed: false };
  } catch (error) {
    console.log("Error extracting and saving Instahyre job data:", error);
    return { companyName: null };
  }
}
