export const BASE_URL = import.meta.env.VITE_SERVER_URL;

export const ENDPOINTS = {
  AUTOMATION_STATUS: "/api/automation/status",
  AUTOMATION_START: "/api/automation/start",
  JOBS_ELIGIBLE: "/api/jobs/eligible",
  JOBS_APPLY: "/api/jobs/apply",
  JOBS_EXPIRED: "/api/jobs/expired",
  ANALYTICS: "/api/analytics",
  ANALYTICS_FILTERS: "/api/analytics/filters",
};

export const getApiUrl = (endpoint: string) => `${BASE_URL}${endpoint}`;
