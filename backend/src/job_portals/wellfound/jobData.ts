import { type Browser, Page } from "puppeteer-core";
import { saveJob, saveEligibleAndAppliedJob } from "../../cloud/db/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { addToProcessStream } from "../../cloud/redis/index.ts";
import { DataJob, WELLFOUND_URL_JOB, blacklistedCompanies, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsScraped, incrementJobsAutoApplied } from "../../utils/automationState.ts";

async function extractData(page: Page, jobId: string) {
  return await page.evaluate(() => {
    const role = document.querySelector('h1.text-xl.font-semibold.text-black')?.textContent?.trim() || '';

    const companyAnchor = document.querySelector('a[href^="/company/"] span');
    const companyName = companyAnchor ? companyAnchor.textContent?.trim() || null : null;

    const topListItems = Array.from(document.querySelectorAll('ul.flex.flex-wrap.text-md.text-black li'));
    let salary = '';
    let experience = '';

    for (const li of topListItems) {
      const text = li.textContent?.trim() || '';
      if (text.includes('₹') || text.includes('$')) {
        salary = text;
      }
      if (text.includes('exp') || text.toLowerCase().includes('year')) {
        experience = text.replace('|', '').trim();
      }
    }

    const locationSpan = Array.from(document.querySelectorAll('span.text-md.font-semibold')).find(el => el.textContent?.trim() === 'Job Location');
    const location = locationSpan?.nextElementSibling?.textContent?.trim() || '';

    const skillsSpan = Array.from(document.querySelectorAll('span.text-md.font-semibold')).find(el => el.textContent?.trim() === 'Skills');
    const skillsContainer = skillsSpan?.nextElementSibling;
    const skillsElements = skillsContainer ? Array.from(skillsContainer.querySelectorAll('div.mr-2.mt-2')) : [];
    const skills = skillsElements.map(el => el.textContent?.trim()).filter(Boolean).join(', ');

    const about = document.querySelector('#job-description')?.textContent?.trim() || '';

    return {
      role,
      companyName,
      salary,
      experience,
      location,
      skills,
      about
    };
  });
}

async function tryApplyJob(page: Page): Promise<boolean> {
  try {
    await delay(WAIT_TIME);

    const submitBtnSelector = 'button[data-test="JobDescriptionSlideIn--SubmitButton"]';
    const applyBtn = await page.$(submitBtnSelector);

    if (!applyBtn) return false;

    const isDisabled = await page.evaluate((btn) => (btn as HTMLButtonElement).disabled, applyBtn);
    if (isDisabled) return false;

    await page.evaluate((btn) => (btn as HTMLButtonElement).click(), applyBtn);

    await delay(WAIT_TIME);

    try {
      await page.waitForFunction(() => {
        const successDiv = document.querySelector('div.bg-green-600');
        if (successDiv && successDiv.textContent?.includes('Congrats! Your application has been submitted.')) {
          return true;
        }
        return document.body.textContent?.includes('Congrats! Your application has been submitted.') || false;
      }, { timeout: 7000 });
      await delay(WAIT_TIME);
      return true;
    } catch {
      await delay(WAIT_TIME);
      return false;
    }
  } catch (error) {
    return false;
  }
}

export async function getJobData(browser: Browser, jobIds: string[]) {
  for (const jobId of jobIds) {
    try {
      const page = await browser.newPage();
      const applicationLink = `${WELLFOUND_URL_JOB}${jobId}`;
      await page.goto(applicationLink, { waitUntil: "load" });
      await delay(WAIT_TIME);

      const data = await extractData(page, jobId);
      await delay(WAIT_TIME);

      const { role, companyName, salary, experience, location, skills, about } = data;

      if (!companyName || !about) {
        await delay(WAIT_TIME);
        await page.close();
        continue;
      }

      if (blacklistedCompanies.includes(companyName.toLowerCase())) {
        await delay(WAIT_TIME);
        await page.close();
        continue;
      }

      const fullDescription = [
        salary ? `Salary: ${salary}` : "",
        location ? `Location: ${location}` : "",
        experience ? `Experience: ${experience}` : "",
        skills ? `Skills: ${skills}` : "",
        about ? `About:\n${about}` : ""
      ].filter(Boolean).join("\n\n");

      const jobData: DataJob = {
        id: null,
        sourceName: "Wellfound",
        sourceJobId: jobId,
        companyName,
        jobId: null,
        description: fullDescription,
        link: applicationLink,
        portal_link: applicationLink,
        role
      };

      const applied = await tryApplyJob(page);

      if (applied) {
        await saveEligibleAndAppliedJob(jobData);
        incrementJobsAutoApplied();
      } else {
        const id = await saveJob(jobData);
        if (id) {
          await addToProcessStream({ id });
          incrementJobsScraped();
        }
      }

      await delay(WAIT_TIME);
      await page.close();
    } catch (err) {
    }
  }
}