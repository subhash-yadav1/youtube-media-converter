import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import { getJob } from "@/lib/server/job-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const job = getJob(id);

  if (!job?.outputPath || job.stage !== "completed" || !job.downloadName) {
    return new Response("File not found.", { status: 404 });
  }

  try {
    const info = await stat(job.outputPath);
    const stream = createReadStream(job.outputPath);

    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        "Content-Type": job.type === "mp3" ? "audio/mpeg" : "video/mp4",
        "Content-Length": String(info.size),
        "Content-Disposition": `attachment; filename="${job.downloadName}"`,
      },
    });
  } catch {
    return new Response("File not found.", { status: 404 });
  }
}
