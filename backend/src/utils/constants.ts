export const WAIT_TIME = 2000;
export const JOB_PORTAL_PAGINATATION = 2;
export const MAX_CONCURRENT_PORTALS = 5;

export const LINKEDIN_URL_JOB = "https://www.linkedin.com/jobs/view/";
export const LINKEDIN_URL_JOB_SEARCH = "https://www.linkedin.com/jobs/search-results/?currentJobId=4442784137&keywords=software%20engineer&origin=JOB_SEARCH_PAGE_JOB_FILTER&referralSearchId=uW6cOvg%2FqGDP91uF52c9Ug%3D%3D&f_TPR=r86400";

export const INSTAHYRE_URL_JOB_SEARCH = "https://www.instahyre.com/candidate/opportunities/?matching=true";

export const WELLFOUND_URL_JOB = "https://wellfound.com/jobs?job_listing_slug=";
export const WELLFOUND_URL_JOB_SEARCH = "https://wellfound.com/jobs";

export const NAUKRI_URL_JOB = "https://www.naukri.com/job-listings-";
export const NAUKRI_URL_JOB_SEARCH = "https://www.naukri.com/software-engineer-software-developer-full-stack-developer-software-development-software-engineering-backend-developer-backend-engineer-frontend-developer-frontend-engineer-web-developer-javascript-developer-typescript-developer-react-developer-node-dot-js-developer-jobs?k=software%20engineer%2C%20software%20developer%2C%20full%20stack%20developer%2C%20software%20development%2C%20software%20engineering%2C%20backend%20developer%2C%20backend%20engineer%2C%20frontend%20developer%2C%20frontend%20engineer%2C%20web%20developer%2C%20javascript%20developer%2C%20typescript%20developer%2C%20react%20developer%2C%20node.js%20developer&nignbevent_src=jobsearchDeskGNB&experience=2&ctcFilter=100to500&ctcFilter=75to100&ctcFilter=50to75&ctcFilter=25to50&ctcFilter=15to25&ugTypeGid=12&ugTypeGid=9502&glbl_qcrc=1028&jobAge=7";

export const CURSHORT_URL_JOB = "https://cutshort.io/profile/all-jobs?matchesfor=65749e03eb780500f05b3e86&minsal=1500000&salaryCurrency=INR&minexp=0&maxexp=2&roletype=full_time";
export const CURSHORT_URL_JOB_SEARCH = "https://cutshort.io/job/"

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