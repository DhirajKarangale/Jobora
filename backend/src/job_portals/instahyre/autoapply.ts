import { edge, closeBrowser } from "../../utils/browserManager.ts";
import { setTimeout as delay } from "node:timers/promises";
import { INSTAHYRE_URL_JOB_SEARCH } from "../../utils/constants.ts";

async function instahyre() {
    const browser = await edge();

    const page = await browser.newPage();
    await page.goto(INSTAHYRE_URL_JOB_SEARCH, { waitUntil: "load" });

    await page.waitForSelector('li#search-dk');
    await page.click('li#search-dk');

    await delay(2000);
    await page.waitForSelector('.employer-row #employer-profile-opportunity');
    await page.click('.employer-row #employer-profile-opportunity');
    await delay(1000);

    while (true) {
        try {
            await page.waitForSelector('.apply button', { visible: true, timeout: 5000 });
            const applyBtn = await page.$('.apply button');

            if (!applyBtn) {
                console.log("No apply button found. Exiting loop.");
                break;
            }

            console.log("Clicking apply...");
            await page.evaluate((btn: any) => btn.click(), applyBtn);
            await delay(1500);

        } catch (error) {
            console.log("No more jobs to apply for or timeout reached. Exiting loop.");
            break;
        }
    }

    await closeBrowser(browser);
}

instahyre().catch(console.error);