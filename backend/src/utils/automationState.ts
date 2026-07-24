let totalJobsScraped = 0;
let totalJobsAutoApplied = 0;
let isProcessStarted = false;

export function incrementJobsScraped(count: number = 1) {
  totalJobsScraped += count;
}

export function incrementJobsAutoApplied(count: number = 1) {
  totalJobsAutoApplied += count;
}

export function setProcessStarted(status: boolean) {
  isProcessStarted = status;
}

export function resetProcessState() {
  totalJobsScraped = 0;
  totalJobsAutoApplied = 0;
  isProcessStarted = true;
}

export function getProcessState() {
  return {
    jobsScraped: totalJobsScraped,
    jobsAutoApplied: totalJobsAutoApplied,
    isRunning: isProcessStarted,
  };
}
