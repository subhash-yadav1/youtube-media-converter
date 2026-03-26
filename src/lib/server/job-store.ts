import { randomUUID } from "node:crypto";

import type { ConversionJob, JobStage, MediaKind } from "@/types/media";

declare global {
  var __youtubeMediaJobs: Map<string, ConversionJob> | undefined;
}

const jobs = globalThis.__youtubeMediaJobs ?? new Map<string, ConversionJob>();

if (!globalThis.__youtubeMediaJobs) {
  globalThis.__youtubeMediaJobs = jobs;
}

function nowIso() {
  return new Date().toISOString();
}

function isActiveStage(stage: JobStage) {
  return stage !== "completed" && stage !== "failed";
}

function isCompletedStage(stage: JobStage) {
  return stage === "completed";
}

export function createJob(input: {
  sourceUrl: string;
  title: string;
  type: MediaKind;
  resolution?: string;
  bitrate?: number;
}) {
  const id = randomUUID();
  const now = nowIso();

  const job: ConversionJob = {
    id,
    sourceUrl: input.sourceUrl,
    title: input.title,
    type: input.type,
    stage: "queued",
    progress: 0,
    resolution: input.resolution,
    bitrate: input.bitrate,
    createdAt: now,
    updatedAt: now,
  };

  jobs.set(id, job);
  return job;
}

export function updateJob(
  jobId: string,
  patch: Partial<ConversionJob> & { stage?: JobStage },
) {
  const current = jobs.get(jobId);

  if (!current) {
    return null;
  }

  const next: ConversionJob = {
    ...current,
    ...patch,
    updatedAt: nowIso(),
  };

  jobs.set(jobId, next);
  return next;
}

export function getJob(jobId: string) {
  return jobs.get(jobId) ?? null;
}

export function countActiveJobs() {
  return [...jobs.values()].filter((job) => isActiveStage(job.stage)).length;
}

export function getActiveJobIds() {
  return new Set(
    [...jobs.values()].filter((job) => isActiveStage(job.stage)).map((job) => job.id),
  );
}

export function getCompletedJobsSortedByUpdatedAt() {
  return [...jobs.values()]
    .filter((job) => isCompletedStage(job.stage))
    .sort((left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt));
}

export function removeJob(jobId: string) {
  jobs.delete(jobId);
}

export function cleanupStaleJobs(maxAgeMs: number) {
  const now = Date.now();

  for (const [jobId, job] of jobs.entries()) {
    if (isActiveStage(job.stage)) {
      continue;
    }

    const updatedAt = Date.parse(job.updatedAt);

    if (!Number.isNaN(updatedAt) && now - updatedAt > maxAgeMs) {
      jobs.delete(jobId);
    }
  }
}
