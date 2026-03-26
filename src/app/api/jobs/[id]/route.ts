import { NextResponse } from "next/server";

import { getJob } from "@/lib/server/job-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = getJob(id);

  if (!job) {
    return NextResponse.json({ error: "Job not found." }, { status: 404 });
  }

  return NextResponse.json({
    ...job,
    downloadUrl: job.stage === "completed" ? `/api/download/${job.id}` : null,
  });
}
