export const LINKEDIN_PAGES = 1;
export const LINKEDIN_URL_JOB = "https://www.linkedin.com/jobs/view/";
export const LINKEDIN_URL_JOB_SEARCH = "https://www.linkedin.com/jobs/search-results/?currentJobId=4442784137&keywords=software%20engineer&origin=JOB_SEARCH_PAGE_JOB_FILTER&referralSearchId=uW6cOvg%2FqGDP91uF52c9Ug%3D%3D&f_TPR=r86400";
export const INSTAHYRE_URL_JOB_SEARCH = "https://www.instahyre.com/candidate/opportunities/?matching=true";

export const MAX_CONCURRENT_PORTALS = 5;

export const blacklistedCompanies = ["infosys", "tcs"];

export interface DataJob {
  id: string | null;
  sourceName: string;
  sourceJobId: string;
  companyName: string | null;
  jobId: string | null;
  description: string | null;
  link: string | null;
  portal_link: string | null;
  role: string | null;
}
