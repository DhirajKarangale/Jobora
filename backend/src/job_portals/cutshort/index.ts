import { type Page } from "puppeteer-core";
import { ResilientBrowser } from "../../utils/resilientBrowser.ts";
import { saveJob, saveEligibleAndAppliedJob, isJobExisting } from "../../cloud/db/index.ts";
import { addToProcessStream } from "../../cloud/redis/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { DataJob, CURSHORT_URL_JOB, CURSHORT_URL_JOB_SEARCH, isBlacklistedCompany, WAIT_TIME } from "../../utils/constants.ts";
import { incrementJobsScraped, incrementJobsAutoApplied } from "../../utils/automationState.ts";

async function safeClosePage(page: Page | null | undefined): Promise<void> {
  if (!page) return;
  try {
    if (!page.isClosed()) {
      await page.close();
    }
  } catch (err: any) {
    if (
      !err?.message?.includes("No target with given id found") &&
      !err?.message?.includes("Target closed")
    ) {
      console.warn("[Cutshort] Notice during page.close:", err.message);
    }
  }
}

async function dismissInterferingModals(page: Page): Promise<boolean> {
  try {
    const dismissed = await page.evaluate(() => {
      const modalSelectors = [
        "#modal__content",
        "div[role='dialog']",
        "div[aria-modal='true']",
        ".modal",
        "div[class*='modal__']",
        "div[class*='Modal_']",
        "div[class*='dialog_']",
        "div[class*='Dialog_']"
      ];

      const allModals = Array.from(
        document.querySelectorAll(modalSelectors.join(", "))
      ).filter((m) => {
        const el = m as HTMLElement;
        return el.offsetWidth > 0 || el.offsetHeight > 0;
      });

      const actionKeywords = [
        "skip",
        "close",
        "continue",
        "done",
        "got it",
        "dismiss",
        "no thanks",
        "cancel",
        "maybe later",
        "remind me later",
        "not now"
      ];

      for (const modal of allModals) {
        const buttons = Array.from(modal.querySelectorAll("button, a"));
        const hasSendButton = buttons.some((b) => {
          const t = (b.textContent || "").trim().toLowerCase();
          return t === "send" || t === "send application";
        });

        // Do not dismiss active apply/send modal
        if (hasSendButton) {
          continue;
        }

        // 1. Search for buttons with action keywords: close, skip, continue, etc.
        const actionBtn = buttons.find((b) => {
          const t = (b.textContent || "").trim().toLowerCase();
          return actionKeywords.some((kw) => t === kw || t.startsWith(kw) || t.includes(kw));
        }) as HTMLElement;

        if (actionBtn && (actionBtn.offsetWidth > 0 || actionBtn.offsetHeight > 0)) {
          actionBtn.click();
          return true;
        }

        // 2. Look for explicit close icon buttons
        const closeIconBtn = modal.querySelector(
          'button[aria-label="Close"], button[aria-label="close"], .close, button.close, [data-dismiss="modal"], svg[data-icon="close"], i.fa-close, i.fa-times'
        ) as HTMLElement;

        if (closeIconBtn && (closeIconBtn.offsetWidth > 0 || closeIconBtn.offsetHeight > 0)) {
          closeIconBtn.click();
          return true;
        }

        // 3. Check for standalone icon/SVG buttons without text
        const svgBtn = buttons.find((b) => {
          const hasSvg = b.querySelector("svg");
          const text = (b.textContent || "").trim();
          return hasSvg && text.length === 0;
        }) as HTMLElement;

        if (svgBtn && (svgBtn.offsetWidth > 0 || svgBtn.offsetHeight > 0)) {
          svgBtn.click();
          return true;
        }
      }

      // Check feedback modal specifically
      const feedbackModal = document.getElementById("modal__content");
      if (feedbackModal) {
        const btns = Array.from(feedbackModal.querySelectorAll("button, a"));
        const skip = btns.find((b) => {
          const t = (b.textContent || "").trim().toLowerCase();
          return actionKeywords.some((kw) => t === kw || t.includes(kw));
        }) as HTMLElement;
        if (skip) {
          skip.click();
          return true;
        }
      }

      return false;
    });

    if (dismissed) {
      console.log("[Cutshort] Dismissed interfering modal.");
      await delay(1000);
      return true;
    }

    return false;
  } catch (err) {
    return false;
  }
}

export default async function cutshort(resilientBrowser: ResilientBrowser): Promise<void> {
  const page = await resilientBrowser.newPage();
  try {
    await page.goto(CURSHORT_URL_JOB, { waitUntil: "networkidle2", timeout: 60000 });
    await delay(WAIT_TIME);

    // Dismiss any initial modal (feedback, survey, update prompt, etc.)
    await dismissInterferingModals(page);

    const jobContainersCount = await page.evaluate(() => {
      return document.querySelectorAll('h3 a[href*="/job/"]').length;
    });

    for (let i = 0; i < jobContainersCount; i++) {
      // Check and dismiss any non-apply modal that may have popped up
      await dismissInterferingModals(page);

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

      const cleanJobId = jobData.jobId.trim().toLowerCase();
      if (!cleanJobId || await isJobExisting(cleanJobId)) continue;

      if (isBlacklistedCompany(jobData.company)) {
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
        sourceJobId: cleanJobId,
        companyName: jobData.company || null,
        jobId: cleanJobId,
        description: fullDescription,
        link: applyLink,
        portal_link: portalLink,
        role: jobData.role
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

      // Dismiss any feedback or rating modal that appeared after applying
      await dismissInterferingModals(page);

      if (applyStatus === 'applied') {
        await saveEligibleAndAppliedJob(dataToSave);
        incrementJobsAutoApplied();
        incrementJobsScraped();
      } else {
        const id = await saveJob(dataToSave);
        if (id) {
          await addToProcessStream({ id });
          incrementJobsScraped();
        }
      }
    }
  } catch (error) {
    console.error("[Cutshort] Automation error:", error);
  } finally {
    await safeClosePage(page);
  }
}
