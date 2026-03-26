import { mkdir, readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

import { getJobRetentionMs } from "@/lib/server/config";

const STORAGE_ROOT = path.join(process.cwd(), "storage");
const JOB_ROOT = path.join(STORAGE_ROOT, "jobs");

export function getJobDirectory(jobId: string) {
  return path.join(JOB_ROOT, jobId);
}

export async function ensureStorageDirectories() {
  await mkdir(JOB_ROOT, { recursive: true });
}

export async function removeJobDirectory(jobId: string) {
  await rm(getJobDirectory(jobId), { recursive: true, force: true });
}

export async function cleanupOverflowJobDirectories(
  maxDirectories: number,
  protectedJobIds: Iterable<string> = [],
) {
  await ensureStorageDirectories();

  const protectedIds = new Set(protectedJobIds);
  const entries = await readdir(JOB_ROOT, { withFileTypes: true });
  const directories = await Promise.all(
    entries
      .filter((entry) => entry.isDirectory() && !protectedIds.has(entry.name))
      .map(async (entry) => {
        const absolutePath = path.join(JOB_ROOT, entry.name);
        const info = await stat(absolutePath);

        return {
          jobId: entry.name,
          mtimeMs: info.mtimeMs,
        };
      }),
  );

  const removableDirectories = directories
    .sort((left, right) => right.mtimeMs - left.mtimeMs)
    .slice(maxDirectories);

  await Promise.all(
    removableDirectories.map(async (directory) => {
      await removeJobDirectory(directory.jobId);
    }),
  );

  return removableDirectories.map((directory) => directory.jobId);
}

export function sanitizeFileName(input: string) {
  return input
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export async function cleanupExpiredJobs() {
  await ensureStorageDirectories();

  const entries = await readdir(JOB_ROOT, { withFileTypes: true });
  const now = Date.now();
  const cleanupMaxAgeMs = getJobRetentionMs();

  await Promise.all(
    entries
      .filter((entry) => entry.isDirectory())
      .map(async (entry) => {
        const absolutePath = path.join(JOB_ROOT, entry.name);
        const info = await stat(absolutePath);

        if (now - info.mtimeMs > cleanupMaxAgeMs) {
          await rm(absolutePath, { recursive: true, force: true });
        }
      }),
  );
}
