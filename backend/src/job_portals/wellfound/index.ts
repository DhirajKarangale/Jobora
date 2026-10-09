import { ResilientBrowser } from "../../utils/resilientBrowser.ts";
import { getJobIds } from "./jobIds.ts";
import { getJobData } from "./jobData.ts";

export default async function wellfound(resilientBrowser: ResilientBrowser) {
    const jobIds = await getJobIds(resilientBrowser);
    await getJobData(resilientBrowser, jobIds);
}
