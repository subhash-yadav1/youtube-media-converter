import { readdir } from "node:fs/promises";
import path from "node:path";

import { getJobDirectory, sanitizeFileName } from "@/lib/server/files";
import { runMaintenance } from "@/lib/server/maintenance";
import { updateJob } from "@/lib/server/job-store";
import { commandExists, spawnCommand } from "@/lib/server/process";

function parseDownloadPercent(line: string) {
  const match = line.match(/(\d{1,3}(?:\.\d+)?)%/);
  return match ? Number(match[1]) : null;
}

function timestampToSeconds(value: string) {
  const [hours, minutes, seconds] = value.split(":").map(Number);

  if ([hours, minutes, seconds].some((part) => Number.isNaN(part))) {
    return null;
  }

  return hours * 3600 + minutes * 60 + seconds;
}

function parseFfmpegProgressSeconds(line: string) {
  if (line.startsWith("out_time=")) {
    return timestampToSeconds(line.replace("out_time=", ""));
  }

  if (line.startsWith("out_time_ms=") || line.startsWith("out_time_us=")) {
    const rawValue = Number(line.split("=")[1]);

    if (Number.isNaN(rawValue)) {
      return null;
    }

    return rawValue > 100000 ? rawValue / 1_000_000 : rawValue / 1_000;
  }

  return null;
}

function progressFromRatio(start: number, end: number, ratio: number) {
  const safeRatio = Math.min(1, Math.max(0, ratio));
  return Math.round(start + (end - start) * safeRatio);
}

async function spawnWithProgress(
  command: string,
  args: string[],
  onLine?: (line: string) => void,
) {
  return new Promise<void>((resolve, reject) => {
    spawnCommand(command, args)
      .then((child) => {
        let stderr = "";
        let stdout = "";

        const handleChunk = (chunk: Buffer) => {
          const text = chunk.toString();
          stdout += text;

          for (const line of text.split(/\r?\n/)) {
            if (line.trim()) {
              onLine?.(line.trim());
            }
          }
        };

        child.stdout?.on("data", handleChunk);
        child.stderr?.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          stderr += text;

          for (const line of text.split(/\r?\n/)) {
            if (line.trim()) {
              onLine?.(line.trim());
            }
          }
        });

        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) {
            resolve();
            return;
          }

          reject(new Error(stderr || stdout || `${command} exited with code ${code}`));
        });
      })
      .catch(reject);
  });
}

async function runFfmpegWithProgress(input: {
  jobId: string;
  args: string[];
  durationSeconds: number | null | undefined;
  progressStart: number;
  progressEnd: number;
}) {
  updateJob(input.jobId, {
    stage: "converting",
    progress: input.progressStart,
  });

  await spawnWithProgress(
    "ffmpeg",
    ["-progress", "pipe:2", "-nostats", ...input.args],
    (line) => {
      const processedSeconds = parseFfmpegProgressSeconds(line);

      if (
        processedSeconds === null ||
        !input.durationSeconds ||
        Number.isNaN(input.durationSeconds) ||
        input.durationSeconds <= 0
      ) {
        return;
      }

      updateJob(input.jobId, {
        stage: "converting",
        progress: progressFromRatio(
          input.progressStart,
          input.progressEnd,
          processedSeconds / input.durationSeconds,
        ),
      });
    },
  );
}

async function resolveDownloadedFile(jobDir: string, prefix: string) {
  const files = await readdir(jobDir);
  const match = files.find((fileName) => fileName.startsWith(`${prefix}.`));

  if (!match) {
    throw new Error(`Expected ${prefix} download output was not found.`);
  }

  return path.join(jobDir, match);
}

function chooseVideoFormat(resolution: string | undefined) {
  if (!resolution) {
    return "bestvideo[ext=mp4]/bestvideo/best";
  }

  return `bestvideo[height<=${resolution}][ext=mp4]/bestvideo[height<=${resolution}]/best[height<=${resolution}]`;
}

async function downloadAudioSource(jobId: string, url: string, targetTemplate: string) {
  await spawnWithProgress("yt-dlp", ["-f", "bestaudio", "-o", targetTemplate, url], (line) => {
    const percent = parseDownloadPercent(line);

    if (percent !== null) {
      updateJob(jobId, {
        stage: "downloading",
        progress: progressFromRatio(10, 58, percent / 100),
      });
    }
  });
}

async function convertToMp3(
  jobId: string,
  sourcePath: string,
  outputPath: string,
  bitrate: number,
  durationSeconds: number | null | undefined,
) {
  await runFfmpegWithProgress({
    jobId,
    durationSeconds,
    progressStart: 60,
    progressEnd: 98,
    args: [
      "-y",
      "-i",
      sourcePath,
      "-vn",
      "-ar",
      "44100",
      "-ac",
      "2",
      "-b:a",
      `${bitrate}k`,
      outputPath,
    ],
  });
}

async function downloadVideoAndAudio(
  jobId: string,
  url: string,
  resolution: string | undefined,
  videoTemplate: string,
  audioTemplate: string,
) {
  await spawnWithProgress(
    "yt-dlp",
    ["-f", chooseVideoFormat(resolution), "-o", videoTemplate, url],
    (line) => {
      const percent = parseDownloadPercent(line);

      if (percent !== null) {
        updateJob(jobId, {
          stage: "downloading",
          progress: progressFromRatio(12, 52, percent / 100),
        });
      }
    },
  );

  await spawnWithProgress("yt-dlp", ["-f", "bestaudio", "-o", audioTemplate, url], (line) => {
    const percent = parseDownloadPercent(line);

    if (percent !== null) {
      updateJob(jobId, {
        stage: "downloading",
        progress: progressFromRatio(52, 88, percent / 100),
      });
    }
  });
}

async function muxMp4(
  jobId: string,
  videoPath: string,
  audioPath: string,
  outputPath: string,
  durationSeconds: number | null | undefined,
) {
  await runFfmpegWithProgress({
    jobId,
    durationSeconds,
    progressStart: 90,
    progressEnd: 99,
    args: [
      "-y",
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-c:v",
      "copy",
      "-c:a",
      "aac",
      outputPath,
    ],
  });
}

async function finalizeCompletedJob(jobId: string, outputPath: string) {
  updateJob(jobId, {
    stage: "completed",
    progress: 100,
    outputPath,
    downloadName: path.basename(outputPath),
  });

  await runMaintenance();
}

export async function startConversionJob(input: {
  jobId: string;
  url: string;
  type: "mp3" | "mp4";
  title: string;
  duration?: number | null;
  resolution?: string;
  bitrate?: number;
}) {
  const [hasYtDlp, hasFfmpeg] = await Promise.all([
    commandExists("yt-dlp"),
    commandExists("ffmpeg"),
  ]);

  if (!hasYtDlp || !hasFfmpeg) {
    throw new Error("Both yt-dlp and ffmpeg must be available to the app.");
  }

  const jobDir = getJobDirectory(input.jobId);
  const safeTitle = sanitizeFileName(input.title) || "youtube-media";

  updateJob(input.jobId, {
    stage: "fetching",
    progress: 8,
  });

  updateJob(input.jobId, {
    title: input.title,
    progress: 10,
  });

  if (input.type === "mp3") {
    const sourceTemplate = path.join(jobDir, "source.%(ext)s");
    const outputPath = path.join(jobDir, `${safeTitle}-${input.bitrate ?? 320}kbps.mp3`);

    await downloadAudioSource(input.jobId, input.url, sourceTemplate);
    const sourcePath = await resolveDownloadedFile(jobDir, "source");
    await convertToMp3(
      input.jobId,
      sourcePath,
      outputPath,
      input.bitrate ?? 320,
      input.duration,
    );

    await finalizeCompletedJob(input.jobId, outputPath);

    return;
  }

  const videoTemplate = path.join(jobDir, "video.%(ext)s");
  const audioTemplate = path.join(jobDir, "audio.%(ext)s");
  const outputLabel = input.resolution ? `${input.resolution}p` : "best";
  const outputPath = path.join(jobDir, `${safeTitle}-${outputLabel}.mp4`);

  await downloadVideoAndAudio(
    input.jobId,
    input.url,
    input.resolution,
    videoTemplate,
    audioTemplate,
  );

  const videoPath = await resolveDownloadedFile(jobDir, "video");
  const audioPath = await resolveDownloadedFile(jobDir, "audio");
  await muxMp4(input.jobId, videoPath, audioPath, outputPath, input.duration);

  await finalizeCompletedJob(input.jobId, outputPath);
}
