import { type Page } from "puppeteer-core";
import { ResilientBrowser } from "../../utils/resilientBrowser.ts";
import { filterExistingJobIds } from "../../cloud/db/index.ts";
import { setTimeout as delay } from "node:timers/promises";
import { JOB_PORTAL_PAGINATATION, WELLFOUND_URL_JOB_SEARCH, WAIT_TIME } from "../../utils/constants.ts";

const JOB_LINK_SELECTOR = 'a[href^="/jobs/"]';

async function extractJobIds(page: Page): Promise<string[]> {
  try {
    await page.waitForSelector(JOB_LINK_SELECTOR, { visible: true, timeout: 10000 });
    const ids = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href^="/jobs/"]'));
      const validIds: string[] = [];

      for (const link of links) {
        const href = link.getAttribute("href") || "";
        if (!href.startsWith("/jobs/")) continue;
        const slug = href.replace("/jobs/", "").trim();
        if (!slug.match(/^\d+-/)) continue;

        // Check surrounding job card / container for "Applied" status
        let card: Element | null = link;
        while (card && card.tagName !== 'BODY') {
          if (
            card.getAttribute('data-test')?.includes('Job') ||
            card.className?.includes('jobListing') ||
            card.className?.includes('styles_result') ||
            card.className?.includes('styles_job') ||
            card.tagName === 'LI'
          ) {
            break;
          }
          card = card.parentElement;
        }
        const cardEl = card || link.parentElement?.parentElement;

        if (cardEl) {
          const cardBadges = Array.from(
            cardEl.querySelectorAll('button, span, div, [class*="badge"], [class*="tag"], [class*="status"]')
          );
          const cardText = (cardEl.textContent || "").toLowerCase();
          const hasGreenBanner = cardEl.querySelector('div.bg-green-600, [class*="bg-green-"], [class*="bg-emerald-"]') !== null;

          const isCardApplied = hasGreenBanner || cardBadges.some(b => {
            const t = (b.textContent || "").trim().toLowerCase();
            return (
              t === "applied" ||
              t === "✓ applied" ||
              t === "applied ✓" ||
              t.startsWith("applied on") ||
              t.startsWith("applied ") ||
              t === "application submitted" ||
              t === "already applied" ||
              t.includes("already applied") ||
              t.includes("application has been submitted") ||
              t.includes("your application has been submitted") ||
              t.includes("congrats! your application")
            );
          }) || cardText.includes("application has been submitted") || cardText.includes("your application has been submitted");

          if (isCardApplied) {
            continue;
          }
        }

        validIds.push(slug);
      }

      return Array.from(new Set(validIds));
    });
    return ids;
  } catch (error) {
    console.error(`[Wellfound] Error extracting job IDs:`, error);
    return [];
  }
}

export async function getJobIds(resilientBrowser: ResilientBrowser): Promise<string[]> {
  const page = await resilientBrowser.newPage();
  try {
    await page.goto(WELLFOUND_URL_JOB_SEARCH, { waitUntil: "domcontentloaded", timeout: 45000 });
  } catch (err: any) {
    console.error("[Wellfound] Search page navigation timeout or error:", err.message);
    try { if (!page.isClosed()) await page.close(); } catch {}
    return [];
  }
  await delay(WAIT_TIME);

  let pageCount = JOB_PORTAL_PAGINATATION;
  const jobIds = new Set<string>();
  let scrollCount = 0;

  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (pageCount-- > 0) {
    const currentJobIds = await extractJobIds(page);
    console.log(`[Wellfound] Scroll ${scrollCount}: Found ${currentJobIds.length} jobs. IDs: ${currentJobIds.join(', ')}`);
    await delay(WAIT_TIME);

    if (currentJobIds.length === 0) {
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        console.log(`[Wellfound] No jobs found on scroll ${scrollCount} after retries. Stopping pagination.`);
        break;
      }
    }

    const initialSize = jobIds.size;
    currentJobIds.forEach(id => {
      if (id) jobIds.add(id.trim().toLowerCase());
    });

    if (jobIds.size === initialSize && currentJobIds.length > 0) {
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        console.log(`[Wellfound] No new unique jobs found on scroll ${scrollCount} after retries. Stopping pagination.`);
        break;
      }
      console.log(`[Wellfound] No new jobs this scroll, retrying... (${retryCount}/${MAX_RETRIES})`);
    } else if (currentJobIds.length > 0) {
      retryCount = 0; // reset on success
    }

    console.log(`[Wellfound] Scrolling down for more jobs... Total unique so far: ${jobIds.size}`);
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    
    scrollCount++;
    await delay(WAIT_TIME);
  }

  await delay(WAIT_TIME);
  await page.close();
  
  console.log(`[Wellfound] Finished collecting job IDs. Total unique found before DB filter: ${jobIds.size}`);
  const uniqueJobIds = await filterExistingJobIds(jobIds);
  console.log(`[Wellfound] Total unique job IDs to process after DB filter: ${uniqueJobIds.length}`);
  return uniqueJobIds;
}