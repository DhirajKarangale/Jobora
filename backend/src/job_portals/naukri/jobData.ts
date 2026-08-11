import { type Browser, Page } from "puppeteer-core";
import { saveJob, saveEligibleAndAppliedJob, isJobExisting } from "../../cloud/db/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { addToProcessStream } from "../../cloud/redis/index.ts";
import { DataJob, NAUKRI_URL_JOB, isBlacklistedCompany, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsScraped, incrementJobsAutoApplied } from "../../utils/automationState.ts";

async function extractData(page: Page, jobId: string) {
  return await page.evaluate(() => {
    const role = document.querySelector('h1.styles_jd-header-title__rZwM1')?.textContent?.trim() || '';

    let companyName = null;
    const header = document.querySelector('header');

    let primaryCompany = null;
    if (header && header.nextElementSibling) {
      if (header.nextElementSibling.tagName.toLowerCase() === 'a') {
        primaryCompany = header.nextElementSibling.textContent?.trim() || null;
      } else {
        const primaryAnchor = header.nextElementSibling.querySelector('a');
        if (primaryAnchor) {
          primaryCompany = primaryAnchor.textContent?.trim() || null;
        }
      }
    }

    let consultantCompany = null;
    const consultantDiv = document.querySelector('.styles_consultant-posted-by__Vb6Hq a');
    if (consultantDiv) {
      consultantCompany = consultantDiv.textContent?.trim() || null;
    }

    const companyAnchorFallback = Array.from(document.querySelectorAll('a')).find(a => a.getAttribute('title')?.endsWith(' Careers'));
    if (!consultantCompany && companyAnchorFallback) {
      const text = companyAnchorFallback.textContent?.trim() || null;
      if (text && text !== primaryCompany) {
        consultantCompany = text;
      }
    }

    if (primaryCompany && consultantCompany && primaryCompany !== consultantCompany) {
      companyName = `${primaryCompany} ${consultantCompany}`;
    } else if (primaryCompany) {
      companyName = primaryCompany;
    } else if (consultantCompany) {
      companyName = consultantCompany;
    } else if (companyAnchorFallback) {
      companyName = companyAnchorFallback.textContent?.trim() || null;
    }

    const expNode = document.querySelector('.styles_jhc__exp__k_giM span');
    const experience = expNode ? expNode.textContent?.trim() || '' : '';

    const salNode = document.querySelector('.styles_jhc__salary__jdfEC span');
    const salary = salNode ? salNode.textContent?.trim() || '' : '';

    const locNode = document.querySelector('.styles_jhc__location__W_pVs');
    const location = locNode ? locNode.textContent?.trim() || '' : '';

    const aboutHtml = document.querySelector('.styles_JDC__dang-inner-html__h0K4t');
    const aboutOther = document.querySelector('.styles_other-details__oEN4O');
    const aboutEdu = document.querySelector('.styles_education__KXFkO');

    let about = '';
    if (aboutHtml) about += aboutHtml.textContent?.trim() + '\n';
    if (aboutOther) about += aboutOther.textContent?.trim() + '\n';
    if (aboutEdu) about += aboutEdu.textContent?.trim() + '\n';

    const skillsContainer = document.querySelector('.styles_key-skill__GIPn_');
    const skillsElements = skillsContainer ? Array.from(skillsContainer.querySelectorAll('a span')) : [];
    const skills = skillsElements.map(el => el.textContent?.trim()).filter(Boolean).join(', ');

    return {
      role,
      companyName,
      salary,
      experience,
      location,
      skills,
      about: about.trim()
    };
  });
}

async function handleApply(browser: Browser, page: Page, currentUrl: string): Promise<{ applied: boolean, applyLink: string }> {
  try {
    await delay(WAIT_TIME);

    const companySiteBtn = await page.$('#company-site-button');
    if (companySiteBtn) {
      const initialPages = await browser.pages();

      const isDisabled = await page.evaluate((btn) => (btn as HTMLButtonElement).disabled, companySiteBtn);
      if (!isDisabled) {
        await page.evaluate((btn) => (btn as HTMLButtonElement).click(), companySiteBtn);

        let newPageUrl = null;
        for (let i = 0; i < 10; i++) {
          await delay(WAIT_TIME);
          const currentPages = await browser.pages();
          const newPages = currentPages.filter(p => !initialPages.includes(p) && p !== page);

          if (newPages.length > 0) {
            const newPage = newPages[0];
            let url = newPage.url();
            let attempts = 0;
            while ((url === 'about:blank' || url === '') && attempts < 15) {
              await delay(WAIT_TIME);
              url = newPage.url();
              attempts++;
            }
            newPageUrl = url !== 'about:blank' && url !== '' ? url : currentUrl;
            await newPage.close();
            break;
          }
        }

        if (newPageUrl) {
          return { applied: false, applyLink: newPageUrl };
        }
      }
    }

    const submitBtnSelector = '#apply-button';
    const applyBtn = await page.$(submitBtnSelector);

    if (!applyBtn) return { applied: false, applyLink: currentUrl };

    const isDisabled = await page.evaluate((btn) => (btn as HTMLButtonElement).disabled, applyBtn);
    if (isDisabled) return { applied: false, applyLink: currentUrl };

    await page.evaluate((btn) => (btn as HTMLButtonElement).click(), applyBtn);

    await delay(WAIT_TIME);

    try {
      const isApplied = await page.waitForFunction(() => {
        const successDiv = document.querySelector('.applied-job-content');
        if (successDiv) {
          return true;
        }
        return document.body.textContent?.includes('Applied to') || false;
      }, { timeout: 7000 });

      if (isApplied) {
        await delay(WAIT_TIME);
        return { applied: true, applyLink: currentUrl };
      }
    } catch {
      await delay(WAIT_TIME);
      return { applied: false, applyLink: currentUrl };
    }
  } catch (error) {
    return { applied: false, applyLink: currentUrl };
  }
  return { applied: false, applyLink: currentUrl };
}

export async function getJobData(browser: Browser, jobIds: string[]) {
  for (const jobId of jobIds) {
    try {
      const cleanJobId = jobId ? jobId.trim().toLowerCase() : "";
      if (!cleanJobId || await isJobExisting(cleanJobId)) continue;

      const page = await browser.newPage();
      const applicationLink = `${NAUKRI_URL_JOB}${cleanJobId}`;
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

      if (isBlacklistedCompany(companyName)) {
        await delay(WAIT_TIME);
        await page.close();
        continue;
      }

      const fullDescription = [
        experience ? `Experience: ${experience}` : "",
        location ? `Location: ${location}` : "",
        salary ? `Salary: ${salary}` : "",
        skills ? `Skills: ${skills}` : "",
        about ? `About:\n${about}` : ""
      ].filter(Boolean).join("\n\n");

      const { applied, applyLink } = await handleApply(browser, page, applicationLink);

      const jobData: DataJob = {
        id: null,
        sourceName: "Naukri",
        sourceJobId: jobId,
        companyName,
        jobId: null,
        description: fullDescription,
        link: applyLink && applyLink !== 'about:blank' ? applyLink : applicationLink,
        portal_link: applicationLink,
        role
      };

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
