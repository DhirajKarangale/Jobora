export const BASE_URL = import.meta.env.VITE_SERVER_URL;

export const ENDPOINTS = {
  AUTOMATION_STATUS: "/api/automation/status",
  AUTOMATION_START: "/api/automation/start",
  AUTOMATION_STOP: "/api/automation/stop",
  JOBS_ELIGIBLE: "/api/jobs/eligible",
  JOBS_APPLY: "/api/jobs/apply",
  JOBS_EXPIRED: "/api/jobs/expired",
  ANALYTICS: "/api/analytics",
  ANALYTICS_FILTERS: "/api/analytics/filters",
  PENDING_JOBS: "/api/automation/pending-jobs",
  CLEAR_PENDING_JOBS: "/api/automation/pending-jobs/clear",
  PENDING_JOBS_UNDO: "/api/automation/pending-jobs/undo",
};

export const getApiUrl = (endpoint: string) => `${BASE_URL}${endpoint}`;
