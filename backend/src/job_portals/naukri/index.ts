import { ResilientBrowser } from "../../utils/resilientBrowser.ts";
import { getJobIds } from "./jobIds.ts";
import { getJobData } from "./jobData.ts";

export default async function naukri(browser: ResilientBrowser) {
    const jobIds = await getJobIds(browser);
    await getJobData(browser, jobIds);
}
