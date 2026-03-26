export type MediaKind = "mp3" | "mp4";

export type JobStage =
  | "queued"
  | "fetching"
  | "downloading"
  | "converting"
  | "completed"
  | "failed";

export interface VideoSuggestion {
  id: string;
  title: string;
  channel: string;
  url: string;
  thumbnail: string | null;
  duration: number | null;
}

export interface VideoResolutionOption {
  formatId: string;
  label: string;
  height: number;
  width: number | null;
  ext: string;
  fps: number | null;
  hasAudio: boolean;
}

export interface AudioOption {
  formatId: string;
  label: string;
  abr: number | null;
  ext: string;
}

export interface VideoInfoPayload {
  id: string;
  title: string;
  description: string;
  thumbnail: string | null;
  duration: number | null;
  channel: string;
  uploader: string;
  webpageUrl: string;
  resolutions: VideoResolutionOption[];
  audioOptions: AudioOption[];
  suggestedBitrates: number[];
  suggestions: VideoSuggestion[];
  dependencies: {
    ytDlp: boolean;
    ffmpeg: boolean;
  };
}

export interface ConversionRequestPayload {
  url: string;
  type: MediaKind;
  resolution?: string;
  bitrate?: number;
}

export interface ConversionJob {
  id: string;
  sourceUrl: string;
  title: string;
  type: MediaKind;
  stage: JobStage;
  progress: number;
  resolution?: string;
  bitrate?: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
  downloadName?: string;
  outputPath?: string;
}
