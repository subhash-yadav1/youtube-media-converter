import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

export interface CommandResult {
  stdout: string;
  stderr: string;
}

interface ResolvedCommandSpec {
  command: string;
  argsPrefix: string[];
  env?: NodeJS.ProcessEnv;
}

function getExecutableNames(command: string) {
  return process.platform === "win32"
    ? [command, `${command}.exe`, `${command}.cmd`, `${command}.bat`]
    : [command];
}

async function resolveExecutablePath(command: string) {
  const executableNames = getExecutableNames(command);
  const pathEntries = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);

  for (const entry of pathEntries) {
    for (const executableName of executableNames) {
      const candidate = path.join(entry, executableName);

      try {
        await access(candidate, constants.X_OK);
        return candidate;
      } catch {
        // Try next candidate.
      }
    }
  }

  return null;
}

async function fileExists(filePath: string | null | undefined) {
  if (!filePath) {
    return false;
  }

  try {
    await access(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolvePythonExecutablePath() {
  return (await resolveExecutablePath("python")) ?? (await resolveExecutablePath("python3"));
}

async function resolveYtDlpSpec(): Promise<ResolvedCommandSpec | null> {
  const ffmpegSpec = await resolveFfmpegSpec();
  const ffmpegArgs = ffmpegSpec ? ["--ffmpeg-location", ffmpegSpec.command] : [];
  const envOverride = process.env.YTDLP_PATH;

  if (await fileExists(envOverride)) {
    return {
      command: envOverride as string,
      argsPrefix: ffmpegArgs,
    };
  }

  const localExecutable = path.join(
    process.cwd(),
    "vendor",
    "bin",
    process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp",
  );

  if (await fileExists(localExecutable)) {
    return {
      command: localExecutable,
      argsPrefix: ffmpegArgs,
    };
  }

  const pathExecutable = await resolveExecutablePath("yt-dlp");

  if (pathExecutable) {
    return {
      command: pathExecutable,
      argsPrefix: ffmpegArgs,
    };
  }

  const vendoredPythonModule = path.join(process.cwd(), "vendor", "python", "yt_dlp");
  const pythonExecutable = await resolvePythonExecutablePath();

  if ((await fileExists(path.join(vendoredPythonModule, "__main__.py"))) && pythonExecutable) {
    const env: NodeJS.ProcessEnv = { ...process.env };
    const currentPythonPath = env.PYTHONPATH;

    env.PYTHONPATH = currentPythonPath
      ? `${path.join(process.cwd(), "vendor", "python")}${path.delimiter}${currentPythonPath}`
      : path.join(process.cwd(), "vendor", "python");

    return {
      command: pythonExecutable,
      argsPrefix: ["-m", "yt_dlp", ...ffmpegArgs],
      env,
    };
  }

  return null;
}

async function resolveFfmpegSpec(): Promise<ResolvedCommandSpec | null> {
  const envOverride = process.env.FFMPEG_PATH;

  if (await fileExists(envOverride)) {
    return {
      command: envOverride as string,
      argsPrefix: [],
    };
  }

  const localStaticBinary = path.join(
    process.cwd(),
    "node_modules",
    "ffmpeg-static",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );

  if (await fileExists(localStaticBinary)) {
    return {
      command: localStaticBinary,
      argsPrefix: [],
    };
  }

  const localExecutable = path.join(
    process.cwd(),
    "vendor",
    "bin",
    process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg",
  );

  if (await fileExists(localExecutable)) {
    return {
      command: localExecutable,
      argsPrefix: [],
    };
  }

  const pathExecutable = await resolveExecutablePath("ffmpeg");

  if (pathExecutable) {
    return {
      command: pathExecutable,
      argsPrefix: [],
    };
  }

  return null;
}

export async function resolveCommandPath(command: string) {
  const spec = await resolveCommandSpec(command);

  return spec?.command ?? null;
}

async function resolveCommandSpec(command: string): Promise<ResolvedCommandSpec | null> {
  if (command === "yt-dlp") {
    return resolveYtDlpSpec();
  }

  if (command === "ffmpeg") {
    return resolveFfmpegSpec();
  }

  const executable = await resolveExecutablePath(command);

  if (!executable) {
    return null;
  }

  return {
    command: executable,
    argsPrefix: [],
  };
}

export async function commandExists(command: string) {
  return Boolean(await resolveCommandSpec(command));
}

export async function spawnCommand(
  command: string,
  args: string[],
  options?: { cwd?: string; stdio?: ("ignore" | "pipe")[] | "pipe" },
) {
  const spec = await resolveCommandSpec(command);

  if (!spec) {
    throw new Error(`${command} is not installed or not available.`);
  }

  return spawn(spec.command, [...spec.argsPrefix, ...args], {
    cwd: options?.cwd,
    env: spec.env,
    stdio: options?.stdio ?? ["ignore", "pipe", "pipe"],
  });
}

export async function runCommand(
  command: string,
  args: string[],
  options?: { cwd?: string },
) {
  return new Promise<CommandResult>((resolve, reject) => {
    spawnCommand(command, args, { cwd: options?.cwd })
      .then((child) => {
        let stdout = "";
        let stderr = "";

        child.stdout?.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });

        child.stderr?.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });

        child.on("error", reject);
        child.on("close", (code) => {
          if (code === 0) {
            resolve({ stdout, stderr });
            return;
          }

          reject(new Error(stderr || stdout || `${command} exited with code ${code}`));
        });
      })
      .catch(reject);
  });
}
