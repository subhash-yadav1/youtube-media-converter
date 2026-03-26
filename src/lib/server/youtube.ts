import { commandExists, runCommand } from "@/lib/server/process";
import type {
  AudioOption,
  VideoInfoPayload,
  VideoResolutionOption,
  VideoSuggestion,
} from "@/types/media";

interface RawFormat {
  format_id?: string;
  ext?: string;
  width?: number;
  height?: number;
  fps?: number;
  acodec?: string;
  vcodec?: string;
  abr?: number;
}

interface RawVideoInfo {
  id: string;
  title?: string;
  description?: string;
  thumbnail?: string;
  duration?: number;
  channel?: string;
  uploader?: string;
  webpage_url?: string;
  formats?: RawFormat[];
  entries?: RawVideoInfo[];
}

function uniqueResolutions(formats: RawFormat[]) {
  const resolutionMap = new Map<string, VideoResolutionOption>();

  for (const format of formats) {
    if (!format.format_id || !format.height || !format.vcodec || format.vcodec === "none") {
      continue;
    }

    const key = `${format.height}-${format.ext}`;

    if (!resolutionMap.has(key)) {
      resolutionMap.set(key, {
        formatId: format.format_id,
        label: format.height >= 2160 ? `4K (${format.height}p)` : `${format.height}p`,
        height: format.height,
        width: format.width ?? null,
        ext: format.ext ?? "mp4",
        fps: format.fps ?? null,
        hasAudio: Boolean(format.acodec && format.acodec !== "none"),
      });
    }
  }

  return [...resolutionMap.values()].sort((left, right) => right.height - left.height);
}

function uniqueAudioOptions(formats: RawFormat[]) {
  const audioMap = new Map<string, AudioOption>();

  for (const format of formats) {
    if (!format.format_id || !format.acodec || format.acodec === "none") {
      continue;
    }

    const key = `${format.abr ?? "na"}-${format.ext ?? "audio"}`;

    if (!audioMap.has(key)) {
      audioMap.set(key, {
        formatId: format.format_id,
        label: `${format.abr ? `${Math.round(format.abr)} kbps` : "Unknown bitrate"} | ${format.ext ?? "audio"}`,
        abr: format.abr ?? null,
        ext: format.ext ?? "m4a",
      });
    }
  }

  return [...audioMap.values()].sort(
    (left, right) => (right.abr ?? 0) - (left.abr ?? 0),
  );
}

function buildSuggestionThumbnail(id: string, thumbnail?: string | null) {
  return thumbnail ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

function mapSuggestions(payload: RawVideoInfo) {
  return (payload.entries ?? [])
    .filter((entry) => entry.id && entry.title)
    .map<VideoSuggestion>((entry) => ({
      id: entry.id,
      title: entry.title ?? "Untitled video",
      channel: entry.channel ?? entry.uploader ?? "Unknown channel",
      url: entry.webpage_url ?? `https://www.youtube.com/watch?v=${entry.id}`,
      thumbnail: buildSuggestionThumbnail(entry.id, entry.thumbnail),
      duration: entry.duration ?? null,
    }));
}

function buildSuggestionQuery(info: RawVideoInfo) {
  return [info.title, info.channel].filter(Boolean).join(" ").slice(0, 80);
}

export async function getBinaryStatus() {
  const [ytDlp, ffmpeg] = await Promise.all([
    commandExists("yt-dlp"),
    commandExists("ffmpeg"),
  ]);

  return { ytDlp, ffmpeg };
}

export async function fetchVideoInfo(url: string): Promise<VideoInfoPayload> {
  const dependencies = await getBinaryStatus();

  if (!dependencies.ytDlp) {
    throw new Error("yt-dlp is not available to the app.");
  }

  const { stdout } = await runCommand("yt-dlp", [
    "--no-playlist",
    "--dump-single-json",
    "--skip-download",
    url,
  ]);

  const raw = JSON.parse(stdout) as RawVideoInfo;
  const resolutions = uniqueResolutions(raw.formats ?? []);
  const audioOptions = uniqueAudioOptions(raw.formats ?? []);

  let suggestions: VideoSuggestion[] = [];
  const suggestionQuery = buildSuggestionQuery(raw);

  if (suggestionQuery) {
    try {
      const related = await runCommand("yt-dlp", [
        "--dump-single-json",
        "--skip-download",
        "--playlist-end",
        "8",
        `ytsearch8:${suggestionQuery}`,
      ]);

      suggestions = mapSuggestions(JSON.parse(related.stdout) as RawVideoInfo).filter(
        (entry) => entry.id !== raw.id,
      );
    } catch {
      suggestions = [];
    }
  }

  return {
    id: raw.id,
    title: raw.title ?? "Untitled video",
    description: raw.description ?? "",
    thumbnail: raw.thumbnail ?? null,
    duration: raw.duration ?? null,
    channel: raw.channel ?? raw.uploader ?? "Unknown channel",
    uploader: raw.uploader ?? raw.channel ?? "Unknown uploader",
    webpageUrl: raw.webpage_url ?? url,
    resolutions,
    audioOptions,
    suggestedBitrates: [128, 192, 230, 320],
    suggestions,
    dependencies,
  };
}
