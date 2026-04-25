export const runtime = "nodejs";

function extractVideoId(input: string | null): string | null {
  if (!input) return null;

  // Try parsing as a URL first
  try {
    const u = new URL(input);

    // youtu.be short links
    if (u.hostname.includes("youtu.be")) {
      const parts = u.pathname.split("/").filter(Boolean);
      const maybe = parts[parts.length - 1];
      if (/^[A-Za-z0-9_-]{11}$/.test(maybe)) return maybe;
    }

    // standard watch?v= links
    const v = u.searchParams.get("v");
    if (v && /^[A-Za-z0-9_-]{11}$/.test(v)) return v;

    // embed links
    const embed = u.pathname.match(/\/embed\/([A-Za-z0-9_-]{11})/);
    if (embed && embed[1]) return embed[1];
  } catch {
    // not a full URL, fall through
  }

  // If input itself looks like an ID
  const m = input.match(/([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const params = url.searchParams;
    const urlParam = params.get("url");
    const idParam = params.get("id");
    const quality = (params.get("quality") ?? "maxres").toLowerCase();

    const id = idParam ?? (urlParam ? extractVideoId(urlParam) : null);

    if (!id) {
      return new Response("Video ID or URL is required.", { status: 400 });
    }

    const candidateLists: Record<string, string[]> = {
      maxres: ["maxresdefault.jpg", "hqdefault.jpg", "sddefault.jpg", "mqdefault.jpg", "default.jpg"],
      hq: ["hqdefault.jpg", "sddefault.jpg", "mqdefault.jpg", "default.jpg"],
      sd: ["sddefault.jpg", "mqdefault.jpg", "hqdefault.jpg", "default.jpg"],
    };

    const candidates = candidateLists[quality] ?? candidateLists["maxres"];

    for (const filename of candidates) {
      const imageUrl = `https://i.ytimg.com/vi/${id}/${filename}`;

      // Check existence with HEAD to avoid downloading large images unnecessarily
      const head = await fetch(imageUrl, { method: "HEAD" });
      if (!head.ok) continue;

      const contentType = head.headers.get("content-type") ?? "image/jpeg";
      if (!contentType.startsWith("image")) continue;

      const imageRes = await fetch(imageUrl);
      if (!imageRes.ok) continue;

      return new Response(imageRes.body, {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="${id}_${filename}"`,
        },
      });
    }

    return new Response("Thumbnail not available.", { status: 404 });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Failed to fetch thumbnail.", { status: 500 });
  }
}
