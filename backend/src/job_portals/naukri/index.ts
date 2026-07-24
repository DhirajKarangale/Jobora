import { type Browser } from "puppeteer-core";
import { getJobIds } from "./jobIds.ts";
import { getJobData } from "./jobData.ts";

export default async function naukri(browser: Browser) {
    const jobIds = await getJobIds(browser);
    await getJobData(browser, jobIds);
}
