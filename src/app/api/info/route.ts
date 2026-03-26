import { NextResponse } from "next/server";

import { runMaintenance } from "@/lib/server/maintenance";
import { fetchVideoInfo } from "@/lib/server/youtube";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    await runMaintenance();

    const body = (await request.json()) as { url?: string };

    if (!body.url) {
      return NextResponse.json({ error: "A YouTube URL is required." }, { status: 400 });
    }

    const payload = await fetchVideoInfo(body.url);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch YouTube video information.",
      },
      { status: 500 },
    );
  }
}
