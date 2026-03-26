"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowDownToLine,
  AudioLines,
  Clapperboard,
  Clock3,
  LoaderCircle,
  Moon,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ConversionJob, MediaKind, VideoInfoPayload } from "@/types/media";

function formatDuration(seconds: number | null) {
  if (!seconds) {
    return "Unknown";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`
    : `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

function stageLabel(stage: ConversionJob["stage"]) {
  switch (stage) {
    case "queued":
      return "Queued";
    case "fetching":
      return "Preparing";
    case "downloading":
      return "Downloading";
    case "converting":
      return "Converting";
    case "completed":
      return "Ready";
    case "failed":
      return "Failed";
    default:
      return stage;
  }
}

function applyTheme(nextDark: boolean) {
  const root = document.documentElement;
  root.classList.toggle("dark", nextDark);
  root.style.colorScheme = nextDark ? "dark" : "light";
  window.localStorage.setItem("theme", nextDark ? "dark" : "light");
}

export function DownloaderShell() {
  const copyrightYear = new Date().getFullYear();
  const outputPanelRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(false);

  const [isDark, setIsDark] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const [url, setUrl] = useState("");
  const [activeType, setActiveType] = useState<MediaKind>("mp4");
  const [info, setInfo] = useState<VideoInfoPayload | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [selectedResolution, setSelectedResolution] = useState("");
  const [selectedBitrate, setSelectedBitrate] = useState("320");
  const [job, setJob] = useState<ConversionJob | null>(null);
  const [jobError, setJobError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [animatedProgress, setAnimatedProgress] = useState(0);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextDark = savedTheme ? savedTheme === "dark" : prefersDark;

    setIsDark(nextDark);
    applyTheme(nextDark);
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (info?.resolutions.length) {
      setSelectedResolution(String(info.resolutions[0].height));
    }
  }, [info]);

  useEffect(() => {
    if (!info || !shouldAutoScrollRef.current) {
      return;
    }

    if (!window.matchMedia("(max-width: 767px)").matches) {
      shouldAutoScrollRef.current = false;
      return;
    }

    const timeout = window.setTimeout(() => {
      outputPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      shouldAutoScrollRef.current = false;
    }, 120);

    return () => window.clearTimeout(timeout);
  }, [info]);

  useEffect(() => {
    if (!job) {
      setAnimatedProgress(0);
      return;
    }

    setAnimatedProgress((current) => (job.progress < current ? job.progress : current));
  }, [job]);

  useEffect(() => {
    if (!job?.id) {
      return;
    }

    const interval = window.setInterval(() => {
      setAnimatedProgress((current) => {
        if (current >= job.progress) {
          return current;
        }

        const gap = job.progress - current;
        const step = gap > 12 ? 4 : gap > 6 ? 2 : 1;
        return Math.min(job.progress, current + step);
      });
    }, 50);

    return () => window.clearInterval(interval);
  }, [job?.id, job?.progress]);

  useEffect(() => {
    if (!job?.id || job.stage === "completed" || job.stage === "failed") {
      return;
    }

    const jobId = job.id;
    let cancelled = false;

    async function pollJob() {
      while (!cancelled) {
        try {
          const response = await fetch(`/api/jobs/${jobId}`);
          const payload = (await response.json()) as ConversionJob | { error: string };

          if (!cancelled && response.ok && !("error" in payload)) {
            setJob(payload);
          }
        } catch {
          // Ignore transient poll failures.
        }

        await new Promise((resolve) => window.setTimeout(resolve, 700));
      }
    }

    void pollJob();

    return () => {
      cancelled = true;
    };
  }, [job?.id, job?.progress, job?.stage]);

  const dependenciesReady = useMemo(
    () => Boolean(info?.dependencies.ytDlp && info?.dependencies.ffmpeg),
    [info],
  );

  const quickSteps = useMemo(
    () => [
      {
        title: "Paste link",
        subtitle: "Drop any YouTube URL to begin.",
        icon: Search,
      },
      {
        title: "Pick quality",
        subtitle: "Choose MP4 resolution or MP3 bitrate.",
        icon: Clapperboard,
      },
      {
        title: "Download",
        subtitle: "Save the converted file when it is ready.",
        icon: ArrowDownToLine,
      },
    ],
    [],
  );

  async function handleInspect() {
    shouldAutoScrollRef.current = true;
    setLoadingInfo(true);
    setInfoError(null);
    setJob(null);
    setJobError(null);

    try {
      const response = await fetch("/api/info", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const payload = (await response.json()) as VideoInfoPayload | { error: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to load video details.");
      }

      if ("error" in payload) {
        throw new Error(payload.error);
      }

      setInfo(payload);
    } catch (error) {
      shouldAutoScrollRef.current = false;
      setInfo(null);
      setInfoError(error instanceof Error ? error.message : "Unable to load video details.");
    } finally {
      setLoadingInfo(false);
    }
  }

  async function handleConvert() {
    if (!info) {
      return;
    }

    setSubmitting(true);
    setJobError(null);

    try {
      const response = await fetch("/api/convert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          type: activeType,
          resolution: activeType === "mp4" ? selectedResolution : undefined,
          bitrate: activeType === "mp3" ? Number(selectedBitrate) : undefined,
        }),
      });

      const payload = (await response.json()) as { jobId: string } | { error: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Unable to start conversion.");
      }

      if ("error" in payload) {
        throw new Error(payload.error);
      }

      setJob({
        id: payload.jobId,
        title: info.title,
        sourceUrl: url,
        type: activeType,
        stage: "queued",
        progress: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        resolution: activeType === "mp4" ? selectedResolution : undefined,
        bitrate: activeType === "mp3" ? Number(selectedBitrate) : undefined,
      });
      setAnimatedProgress(0);
    } catch (error) {
      setJobError(error instanceof Error ? error.message : "Unable to start conversion.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleToggleTheme() {
    const nextDark = !isDark;
    setIsDark(nextDark);
    applyTheme(nextDark);
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,146,60,0.18),transparent_28%),linear-gradient(180deg,#fff9f5_0%,#fff_45%,#fff6ec_100%)] transition-colors dark:bg-[radial-gradient(circle_at_top,rgba(249,115,22,0.16),transparent_24%),linear-gradient(180deg,#09090b_0%,#111827_52%,#18181b_100%)]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <header className="flex items-center justify-between rounded-[1.5rem] border border-white/60 bg-white/75 px-4 py-3 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-orange-500 text-white shadow-lg shadow-orange-500/20">
              <Clapperboard className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">YouTube Media</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">MP4, MP3, and related picks</p>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleToggleTheme}
            className="rounded-2xl bg-white/80 dark:bg-white/5"
            aria-label="Toggle theme"
          >
            {themeReady && isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </Button>
        </header>

        <section className="overflow-hidden rounded-[2rem] border border-white/65 bg-white/80 p-5 shadow-[0_30px_80px_rgba(249,115,22,0.1)] backdrop-blur dark:border-white/10 dark:bg-white/5 sm:p-7">
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-6">
              <div className="space-y-3">
                <h1 className="max-w-3xl text-3xl font-semibold leading-tight text-zinc-950 dark:text-zinc-50 sm:text-5xl">
                  Download YouTube video and audio with a cleaner, more focused workflow.
                </h1>
                <p className="max-w-2xl text-sm leading-7 text-zinc-600 dark:text-zinc-300 sm:text-base">
                  Paste a link, inspect the available qualities, choose your format, and download without digging through clutter.
                </p>
              </div>

              <div className="rounded-[1.5rem] border border-zinc-200/70 bg-white/85 p-3 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-3 sm:flex-row">
                  <Input
                    value={url}
                    onChange={(event) => setUrl(event.target.value)}
                    placeholder="Paste a YouTube link"
                    className="h-12 rounded-2xl bg-white dark:bg-zinc-950/60"
                  />
                  <Button
                    onClick={handleInspect}
                    disabled={!url.trim() || loadingInfo}
                    size="lg"
                    className="h-12 rounded-2xl px-5"
                  >
                    {loadingInfo ? <LoaderCircle className="animate-spin" /> : <Search />}
                    Inspect
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {quickSteps.map((step) => (
                <Card
                  key={step.title}
                  className="rounded-[1.5rem] border-zinc-200/70 bg-gradient-to-b from-white to-orange-50/50 shadow-none dark:border-white/10 dark:from-white/5 dark:to-white/[0.03]"
                >
                  <CardContent className="flex items-center gap-3 p-4">
                    <div className="flex size-11 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300">
                      <step.icon className="size-5" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-zinc-950 dark:text-zinc-50">{step.title}</p>
                      <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">{step.subtitle}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {infoError ? (
          <div className="flex items-start gap-3 rounded-[1.5rem] border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4" />
            <p>{infoError}</p>
          </div>
        ) : null}

        {loadingInfo ? (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="rounded-[1.75rem] border-zinc-200/70 bg-white/90 shadow-none dark:border-white/10 dark:bg-white/5">
              <CardContent className="grid gap-5 p-5 md:grid-cols-[280px_minmax(0,1fr)]">
                <Skeleton className="aspect-video rounded-[1.5rem]" />
                <div className="space-y-4">
                  <Skeleton className="h-8 w-3/4 rounded-full" />
                  <Skeleton className="h-4 w-1/3 rounded-full" />
                  <Skeleton className="h-4 w-full rounded-full" />
                  <Skeleton className="h-24 w-full rounded-[1.5rem]" />
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[1.75rem] border-zinc-200/70 bg-white/90 shadow-none dark:border-white/10 dark:bg-white/5">
              <CardContent className="space-y-4 p-5">
                <Skeleton className="h-10 w-full rounded-2xl" />
                <Skeleton className="h-11 w-full rounded-2xl" />
                <Skeleton className="h-11 w-full rounded-2xl" />
                <Skeleton className="h-12 w-full rounded-2xl" />
              </CardContent>
            </Card>
          </section>
        ) : null}

        {info ? (
          <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Card className="overflow-hidden rounded-[1.75rem] border-zinc-200/70 bg-white/90 shadow-none dark:border-white/10 dark:bg-white/5">
              <CardContent className="grid gap-5 p-5 lg:grid-cols-[300px_minmax(0,1fr)]">
                <div className="space-y-4">
                  <div className="relative aspect-video overflow-hidden rounded-[1.5rem] bg-zinc-100 dark:bg-zinc-900">
                    {info.thumbnail ? (
                      <Image
                        src={info.thumbnail}
                        alt={info.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/90 p-3 dark:border-white/10 dark:bg-white/5">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Channel</p>
                      <p className="mt-2 line-clamp-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {info.channel}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/90 p-3 dark:border-white/10 dark:bg-white/5">
                      <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-400">Duration</p>
                      <p className="mt-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {formatDuration(info.duration)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="space-y-2">
                    <h2 className="text-2xl font-semibold leading-tight text-zinc-950 dark:text-zinc-50 sm:text-3xl">
                      {info.title}
                    </h2>
                    <p className="text-sm leading-7 text-zinc-600 dark:text-zinc-300">
                      {info.description || "No description available for this video."}
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      <Clapperboard className="size-4 text-orange-500" />
                      Video qualities
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {info.resolutions.map((resolution) => (
                        <Badge
                          key={resolution.formatId}
                          variant="outline"
                          className="rounded-full border-zinc-200 bg-white px-3 py-1.5 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                        >
                          {resolution.label}
                          {resolution.fps ? ` | ${resolution.fps} fps` : ""}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">
                      <AudioLines className="size-4 text-orange-500" />
                      Audio formats
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {info.audioOptions.slice(0, 4).map((audio) => (
                        <div
                          key={audio.formatId}
                          className="rounded-2xl border border-zinc-200/70 bg-zinc-50/80 px-3 py-3 text-sm text-zinc-700 dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
                        >
                          {audio.label}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div ref={outputPanelRef}>
              <Card className="rounded-[1.75rem] border-zinc-200/70 bg-white/92 shadow-none dark:border-white/10 dark:bg-white/5 xl:sticky xl:top-6">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl text-zinc-950 dark:text-zinc-50">Download</CardTitle>
                  <CardDescription className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                    Choose your output and start the conversion.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <Tabs
                    value={activeType}
                    onValueChange={(value) => {
                      if (value) {
                        setActiveType(value as MediaKind);
                      }
                    }}
                  >
                    <TabsList className="grid w-full grid-cols-2 rounded-2xl p-1">
                      <TabsTrigger value="mp4" className="rounded-xl">
                        <Clapperboard className="size-4" />
                        MP4
                      </TabsTrigger>
                      <TabsTrigger value="mp3" className="rounded-xl">
                        <AudioLines className="size-4" />
                        MP3
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="mp4" className="space-y-2 pt-4">
                      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        Resolution
                      </label>
                      <Select
                        value={selectedResolution}
                        onValueChange={(value) => setSelectedResolution(value ?? "")}
                      >
                        <SelectTrigger className="h-12 w-full rounded-2xl bg-white dark:bg-zinc-950/50">
                          <SelectValue placeholder="Choose a resolution" />
                        </SelectTrigger>
                        <SelectContent>
                          {info.resolutions.map((item) => (
                            <SelectItem key={item.formatId} value={String(item.height)}>
                              {item.label}
                              {item.fps ? ` | ${item.fps} fps` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TabsContent>

                    <TabsContent value="mp3" className="space-y-2 pt-4">
                      <label className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
                        Bitrate
                      </label>
                      <Select
                        value={selectedBitrate}
                        onValueChange={(value) => setSelectedBitrate(value ?? "320")}
                      >
                        <SelectTrigger className="h-12 w-full rounded-2xl bg-white dark:bg-zinc-950/50">
                          <SelectValue placeholder="Choose a bitrate" />
                        </SelectTrigger>
                        <SelectContent>
                          {info.suggestedBitrates.map((bitrate) => (
                            <SelectItem key={bitrate} value={String(bitrate)}>
                              {bitrate} kbps
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TabsContent>
                  </Tabs>

                  <div className="rounded-2xl border border-zinc-200/70 bg-zinc-50/90 p-4 text-sm text-zinc-600 dark:border-white/10 dark:bg-white/5 dark:text-zinc-300">
                    MP4 keeps the selected source quality. MP3 exports at your chosen bitrate.
                  </div>

                  <Separator />

                  <Button
                    onClick={handleConvert}
                    disabled={!dependenciesReady || submitting}
                    size="lg"
                    className="h-12 w-full rounded-2xl"
                  >
                    {submitting ? (
                      <LoaderCircle className="animate-spin" />
                    ) : (
                      <ArrowDownToLine />
                    )}
                    Start {activeType.toUpperCase()}
                  </Button>

                  {jobError ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                      {jobError}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            </div>
          </section>
        ) : null}

        {job ? (
          <Card className="rounded-[1.75rem] border-zinc-200/70 bg-white/92 shadow-none dark:border-white/10 dark:bg-white/5">
            <CardHeader className="space-y-2">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-5 text-orange-500" />
                    <CardTitle className="text-2xl text-zinc-950 dark:text-zinc-50">Conversion progress</CardTitle>
                  </div>
                  <CardDescription className="text-zinc-600 dark:text-zinc-300">
                    {job.title} | {job.type.toUpperCase()} | {stageLabel(job.stage)}
                  </CardDescription>
                </div>
                <Badge variant={job.stage === "failed" ? "destructive" : "secondary"} className="w-fit rounded-full px-3 py-1.5">
                  {stageLabel(job.stage)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-zinc-700 dark:text-zinc-200">{stageLabel(job.stage)}</span>
                    <span className="text-zinc-500 dark:text-zinc-400">{animatedProgress}%</span>
                  </div>
                  <Progress value={animatedProgress} />
                </div>

                {job.stage === "completed" ? (
                  <a
                    href={`/api/download/${job.id}`}
                    className={buttonVariants({ size: "lg", className: "h-12 rounded-2xl" })}
                  >
                    <ArrowDownToLine />
                    Download file
                  </a>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
                {job.resolution ? (
                  <span className="rounded-full bg-zinc-100 px-3 py-1.5 dark:bg-white/10">{job.resolution}p</span>
                ) : null}
                {job.bitrate ? (
                  <span className="rounded-full bg-zinc-100 px-3 py-1.5 dark:bg-white/10">{job.bitrate} kbps</span>
                ) : null}
              </div>

              {job.error ? (
                <div className="rounded-2xl border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                  {job.error}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {info?.suggestions.length ? (
          <section className="space-y-4">
            <div className="space-y-1">
              <h3 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">Related suggestions</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-300">
                More videos connected to what you just pasted.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {info.suggestions.map((suggestion) => (
                <a
                  key={suggestion.id}
                  href={suggestion.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group"
                >
                  <Card className="h-full overflow-hidden rounded-[1.5rem] border-zinc-200/70 bg-white/92 shadow-none transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5">
                    <CardContent className="p-0">
                      <div className="relative aspect-video overflow-hidden bg-zinc-100 dark:bg-zinc-900">
                        {suggestion.thumbnail ? (
                          <Image
                            src={suggestion.thumbnail}
                            alt={suggestion.title}
                            fill
                            className="object-cover transition duration-300 group-hover:scale-[1.04]"
                            unoptimized
                          />
                        ) : null}
                        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white">
                          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] backdrop-blur">
                            <Clock3 className="size-3.5" />
                            {formatDuration(suggestion.duration)}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2 p-4">
                        <h4 className="line-clamp-2 text-base font-semibold leading-6 text-zinc-950 dark:text-zinc-50">
                          {suggestion.title}
                        </h4>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">{suggestion.channel}</p>
                      </div>
                    </CardContent>
                  </Card>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <footer className="border-t border-zinc-200/70 px-1 pt-2 text-center text-sm text-zinc-500 dark:border-white/10 dark:text-zinc-400">
          <p>Copyright {copyrightYear} YouTube Media. All rights reserved.</p>
        </footer>
      </div>
    </main>
  );
}
