import { edge } from "./src/utils/browserManager.ts";
import { handleResume, unfollowCompany, submitApplication, handleQuestions } from "./src/job_portals/linkedin/autoApply.ts";
import { setTimeout as delay } from "node:timers/promises";
import { WAIT_TIME } from "./src/utils/constants.ts";
async function run() {
  console.log("Starting browser connection...");
  const browser = await edge();
  const page = await browser.newPage();
  const jobId = "4448294208";
  console.log(`Navigating to job ${jobId}...`);
  await page.goto(`https://www.linkedin.com/jobs/view/${jobId}`, { waitUntil: "load" });
  await delay(4000);

  console.log("Looking for Easy Apply button...");

  // Wait for the button to appear in the DOM first to ensure page is stable
  try {
    await page.waitForSelector('.jobs-apply-button, [aria-label="LinkedIn Apply to this job"]', { timeout: 10000 });
  } catch (e) {
    console.log("No Easy Apply button found.");
    process.exit(1);
  }

  const easyApplyBtnHandle = await page.evaluateHandle(() => {
    const btns = Array.from(document.querySelectorAll('.jobs-apply-button, [aria-label="LinkedIn Apply to this job"]'));
    // Find first visible button
    return btns.find(b => (b as HTMLElement).offsetParent !== null) || btns[0] || null;
  });

  const easyApplyBtn = easyApplyBtnHandle.asElement() as import('puppeteer-core').ElementHandle<Element> | null;

  if (easyApplyBtn) {
    const href = await easyApplyBtn.evaluate(b => b.getAttribute('href'));

    if (href && href.includes('apply')) {
      const fullUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
      console.log(`Navigating directly to apply flow URL: ${fullUrl}`);
      // Wait for navigation to complete before proceeding
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });
    } else {
      console.log("Found Easy Apply button, clicking via evaluate...");
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 5000 }).catch(() => { }),
        easyApplyBtn.evaluate(b => (b as HTMLElement).click())
      ]);
    }

    console.log("Waiting for modal to appear...");
    try {
      await page.waitForSelector('.jobs-easy-apply-modal, button[aria-label="Continue to next step"], button[aria-label="Submit application"]', { timeout: 15000 });
      await delay(1500); // Wait a bit more for rendering to settle
      console.log("Modal detected!");
    } catch (e) {
      console.log("Timed out waiting for modal content. Continuing anyway...");
    }

    // Loop through modal pages
    for (let i = 0; i < 10; i++) {
      console.log(`\n--- Step ${i + 1} ---`);

      // 1. Test Resume
      console.log("Testing handleResume...");
      const resumeHandled = await handleResume(page, "DhirajKarangale.pdf");
      console.log(`Resume selected: ${resumeHandled}`);
      await delay(WAIT_TIME);

      // 1.5 Test Questions
      console.log("Testing handleQuestions...");
      const allQuestionsHandled = await handleQuestions(page);
      await delay(WAIT_TIME);

      if (!allQuestionsHandled) {
        console.log("Some required questions were left unanswered. Stopping application flow.");
        break;
      }

      // 2. Test Unfollow
      console.log("Testing unfollowCompany...");
      await unfollowCompany(page);
      await delay(WAIT_TIME);

      // 3. Try Next, Review, Submit button
      console.log("Looking for Next, Review, or Submit button to proceed...");
      const proceedBtnHandle = await page.evaluateHandle(() => {
        const nextBtn = document.querySelector('button[aria-label="Continue to next step"]');
        const reviewBtn = document.querySelector('button[aria-label="Review your application"]');
        const submitBtn = document.querySelector('button[aria-label="Submit application"]');
        return nextBtn || reviewBtn || submitBtn || null;
      });

      const proceedBtn = proceedBtnHandle.asElement() as import('puppeteer-core').ElementHandle<Element> | null;
      if (proceedBtn) {
        const label = await proceedBtn.evaluate(b => b.getAttribute('aria-label') || b.textContent?.trim() || '');
        console.log(`Clicking '${label}'...`);
        await proceedBtn.click();
        await delay(WAIT_TIME);

        if (label.toLowerCase().includes("submit")) {
          console.log("Successfully clicked 'Submit application'!");
          break;
        }
      } else {
        console.log("No Next/Review/Submit button found, or something went wrong.");
        break;
      }
    }
  } else {
    console.log("No Easy Apply button found.");
  }

  console.log("Done. Check the browser to see the result!");
  // Disconnect from browser without closing it so you can inspect
  browser.disconnect();
}

run().catch(console.error);
