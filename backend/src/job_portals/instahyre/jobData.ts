import { type Page } from "puppeteer-core";
import { DataJob } from "../../utils/constants.ts";
import { saveEligibleAndAppliedJob } from "../../cloud/db/index.ts";

export async function extractJobData(page: Page) {
  try {
    const data = await page.evaluate(() => {
      const companyName = document.querySelector("h2.company-name")?.textContent?.trim() || null;

      const locationIcon = document.querySelector("i.fa-map-marker");
      const location = locationIcon?.parentElement?.textContent?.trim() || null;
      const experience = document.querySelector(".experience")?.textContent?.trim() || null;
      const role = document.querySelector("h1")?.textContent?.trim() || null;
      const description = document.querySelector("div.profile-content.job-description")?.textContent?.trim() || null;
      const companyLink = (document.querySelector("a#employer-website") as HTMLAnchorElement)?.href || null;

      return {
        companyName,
        location,
        experience,
        role,
        description,
        companyLink
      };
    });

    const fullDescription = [
      data.role ? `Role: ${data.role}` : "",
      data.experience ? `Experience: ${data.experience}` : "",
      data.location ? `Location: ${data.location}` : "",
      data.description || ""
    ].filter(Boolean).join("\n\n");

    const jobData: DataJob = {
      id: null,
      sourceName: "Instahyre",
      sourceJobId: "",
      companyName: data.companyName,
      jobId: "",
      description: fullDescription,
      link: data.companyLink
    };

    await saveEligibleAndAppliedJob(jobData);
  } catch (error) {
    console.log("Error extracting and saving Instahyre job data:", error);
  }
}
