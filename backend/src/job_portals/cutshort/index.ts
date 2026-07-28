import { type Browser, type Page } from "puppeteer-core";
import { saveJob, saveEligibleAndAppliedJob } from "../../cloud/db/index.ts";
import { addToProcessStream } from "../../cloud/redis/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { DataJob, CURSHORT_URL_JOB, CURSHORT_URL_JOB_SEARCH, blacklistedCompanies, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsScraped, incrementJobsAutoApplied } from "../../utils/automationState.ts";

export default async function cutshort(browser: Browser): Promise<void> {
  const page = await browser.newPage();
  try {
    await page.goto(CURSHORT_URL_JOB, { waitUntil: "networkidle2", timeout: 60000 });
    await delay(WAIT_TIME);

    const jobContainersCount = await page.evaluate(() => {
      return document.querySelectorAll('h3 a[href*="/job/"]').length;
    });

    for (let i = 0; i < jobContainersCount; i++) {
      const jobData = await page.evaluate(async (index) => {
        const titleLinks = document.querySelectorAll('h3 a[href*="/job/"]');
        const titleLink = titleLinks[index];
        if (!titleLink) return null;

        const container = titleLink.closest('div[display="flex"]') || titleLink.parentElement?.parentElement?.parentElement?.parentElement;
        if (!container) return null;

        const moreBtn = Array.from(container.querySelectorAll('div')).find(el => el.textContent?.trim().match(/^\+\d+\s+more$/i));
        if (moreBtn) {
          (moreBtn as HTMLElement).click();
          await new Promise(r => setTimeout(r, 500));

          const lessBtn = Array.from(container.querySelectorAll('div')).find(el => el.textContent?.trim() === 'Show less');
          if (lessBtn) {
            (lessBtn as HTMLElement).click();
            await new Promise(r => setTimeout(r, 500));
          }
        }

        const role = titleLink.textContent?.trim() || '';
        const href = titleLink.getAttribute('href') || '';
        const jobIdMatch = href.match(/\/job\/([^?]+)/);
        const jobId = jobIdMatch ? jobIdMatch[1] : '';

        const companyNode = container.querySelector('a[href^="/company/"]');
        const company = companyNode ? companyNode.textContent?.trim() : '';

        let location = '';
        let experience = '';
        let salary = '';

        const allTextDivs = Array.from(container.querySelectorAll('div'));
        for (const div of allTextDivs) {
          const text = div.textContent?.trim() || '';
          if (text.includes('yrs') && text.length < 20) {
            experience = text;
          }
          if ((text.includes('₹') || text.includes('$') || text.toLowerCase().includes('industry')) && text.length < 30 && !text.includes('yrs')) {
            salary = text;
          }
          if ((text.toLowerCase().includes('remote') || text.toLowerCase().includes('hybrid') || text.toLowerCase().includes('on-site')) && text.length < 30) {
            location = text;
          }
        }

        let skills = '';
        const skillContainer = Array.from(container.querySelectorAll('div')).find(el => Array.from(el.querySelectorAll('img[alt="skill icon"]')).length > 0);
        if (skillContainer) {
          skills = Array.from(skillContainer.querySelectorAll('span')).map(s => s.textContent?.trim()).filter(Boolean).join(', ');
        } else {
          const allSkillSpans = Array.from(container.querySelectorAll('div > span')).filter(s => s.parentElement?.querySelectorAll('img[alt="skill icon"]').length);
          skills = allSkillSpans.map(s => s.textContent?.trim()).filter(Boolean).join(', ');
        }

        const aboutContainer = container.querySelector('.prose');
        const about = aboutContainer ? aboutContainer.textContent?.trim() : '';

        return { jobId, role, company, location, experience, salary, skills, about };
      }, i);

      if (!jobData || !jobData.jobId) continue;

      if (jobData.company && blacklistedCompanies.some(company => jobData.company.toLowerCase().includes(company))) {
        continue;
      }

      const applyLink = `${CURSHORT_URL_JOB_SEARCH}${jobData.jobId}`;
      const portalLink = applyLink;

      const fullDescription = [
        jobData.location ? `Location: ${jobData.location}` : "",
        jobData.experience ? `Experience: ${jobData.experience}` : "",
        jobData.salary ? `Salary: ${jobData.salary}` : "",
        jobData.skills ? `Skills: ${jobData.skills}` : "",
        jobData.about ? `About:\n${jobData.about}` : ""
      ].filter(Boolean).join("\n\n");

      const dataToSave: DataJob = {
        id: null,
        sourceName: "Cutshort",
        sourceJobId: jobData.jobId,
        companyName: jobData.company || null,
        jobId: jobData.jobId,
        description: fullDescription,
        link: applyLink,
        portal_link: portalLink,
        role: jobData.role,
        isEligible: true
      };

      const applyStatus = await page.evaluate(async (index) => {
        const titleLinks = document.querySelectorAll('h3 a[href*="/job/"]');
        const titleLink = titleLinks[index];
        const container = titleLink.closest('div[display="flex"]') || titleLink.parentElement?.parentElement?.parentElement?.parentElement;

        if (!container) return 'failed';

        const buttons = Array.from(container.querySelectorAll('button'));
        const applyBtn = buttons.find(b => b.textContent?.trim() === 'Apply now');
        if (!applyBtn) return 'not_found';

        applyBtn.click();
        await new Promise(r => setTimeout(r, 2000));

        const sendBtns = Array.from(document.querySelectorAll('button'));
        const sendBtn = sendBtns.find(b => b.textContent?.trim() === 'Send');
        if (sendBtn) {
          sendBtn.click();
          await new Promise(r => setTimeout(r, 3000));
        }

        const links = Array.from(container.querySelectorAll('a'));
        const viewConvLink = links.find(l => l.textContent?.trim() === 'View conversation');
        return viewConvLink ? 'applied' : 'failed';
      }, i);

      await delay(WAIT_TIME);

      if (applyStatus === 'applied') {
        await saveEligibleAndAppliedJob(dataToSave);
        incrementJobsAutoApplied();
      } else {
        const id = await saveJob(dataToSave);
        if (id) {
          incrementJobsScraped();
        }
      }
    }
  } catch (error) {
    // console.error("Cutshort Automation Error:", error);
  } finally {
    await page.close();
  }
}
