import { getJobRetentionMs, serverConfig } from "@/lib/server/config";
import {
  cleanupExpiredJobs,
  cleanupOverflowJobDirectories,
  ensureStorageDirectories,
  removeJobDirectory,
} from "@/lib/server/files";
import {
  cleanupStaleJobs,
  getActiveJobIds,
  getCompletedJobsSortedByUpdatedAt,
  removeJob,
} from "@/lib/server/job-store";

async function cleanupStoredJobDirectories() {
  const removedJobIds = await cleanupOverflowJobDirectories(
    serverConfig.maxStoredCompletedJobs,
    getActiveJobIds(),
  );

  for (const jobId of removedJobIds) {
    removeJob(jobId);
  }
}

async function cleanupStoredCompletedJobs() {
  const completedJobs = getCompletedJobsSortedByUpdatedAt();
  const removableJobs = completedJobs.slice(serverConfig.maxStoredCompletedJobs);

  await Promise.all(
    removableJobs.map(async (job) => {
      await removeJobDirectory(job.id);
      removeJob(job.id);
    }),
  );
}

export async function runMaintenance() {
  await ensureStorageDirectories();
  await cleanupExpiredJobs();
  await cleanupStoredJobDirectories();
  await cleanupStoredCompletedJobs();
  cleanupStaleJobs(getJobRetentionMs());
}
