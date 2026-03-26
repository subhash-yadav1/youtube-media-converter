function readPositiveInteger(name: string, fallback: number) {
  const rawValue = process.env[name];

  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }

  return parsed;
}

export const serverConfig = {
  maxActiveJobs: readPositiveInteger("MAX_ACTIVE_JOBS", 2),
  jobRetentionHours: readPositiveInteger("JOB_RETENTION_HOURS", 2),
  maxStoredCompletedJobs: readPositiveInteger("MAX_STORED_COMPLETED_JOBS", 2),
};

export function getJobRetentionMs() {
  return serverConfig.jobRetentionHours * 60 * 60 * 1000;
}
