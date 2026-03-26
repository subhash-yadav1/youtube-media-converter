import { mkdir } from "node:fs/promises";

import { NextResponse } from "next/server";

import { serverConfig } from "@/lib/server/config";
import { startConversionJob } from "@/lib/server/conversion";
import { getJobDirectory, removeJobDirectory } from "@/lib/server/files";
import { createJob, countActiveJobs, updateJob } from "@/lib/server/job-store";
import { runMaintenance } from "@/lib/server/maintenance";
import { fetchVideoInfo } from "@/lib/server/youtube";
import type { ConversionRequestPayload } from "@/types/media";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await runMaintenance();

    const body = (await request.json()) as ConversionRequestPayload;

    if (!body.url || !body.type) {
      return NextResponse.json({ error: "URL and output type are required." }, { status: 400 });
    }

    if (countActiveJobs() >= serverConfig.maxActiveJobs) {
      return NextResponse.json(
        {
          error: `The server is handling the maximum number of conversions right now. Please try again in a minute.`,
        },
        { status: 429 },
      );
    }

    const info = await fetchVideoInfo(body.url);
    const job = createJob({
      sourceUrl: body.url,
      title: info.title,
      type: body.type,
      resolution: body.resolution,
      bitrate: body.bitrate,
    });

    await mkdir(getJobDirectory(job.id), { recursive: true });

    void startConversionJob({
      jobId: job.id,
      url: body.url,
      type: body.type,
      title: info.title,
      duration: info.duration,
      resolution: body.resolution,
      bitrate: body.bitrate,
    }).catch((error: unknown) => {
      updateJob(job.id, {
        stage: "failed",
        error: error instanceof Error ? error.message : "Conversion failed.",
      });

      void removeJobDirectory(job.id);
    });

    return NextResponse.json({
      jobId: job.id,
      statusUrl: `/api/jobs/${job.id}`,
      downloadUrl: `/api/download/${job.id}`,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start conversion.",
      },
      { status: 500 },
    );
  }
}
