# YouTube Media

YouTube Media is a full-stack Next.js app that inspects a YouTube URL, shows available qualities, converts the video to `MP4` or `MP3`, and surfaces related video suggestions.

The project is built for self-hosting. It uses:

- `Next.js` App Router
- `shadcn/ui`
- `yt-dlp`
- `ffmpeg`
- local filesystem storage under `storage/jobs`

## Local development

### Requirements

- Node.js `22.x` recommended
- `ffmpeg`
- `yt-dlp`

If you do not want to rely on system `PATH`, you can also set explicit binary paths in `.env.local`.

### Environment

Copy `.env.example` to `.env.local` and adjust values if needed.

```bash
cp .env.example .env.local
```

Available variables:

- `MAX_ACTIVE_JOBS`: maximum number of concurrent conversions allowed
- `JOB_RETENTION_HOURS`: how long completed job files remain on disk
- `MAX_STORED_COMPLETED_JOBS`: how many completed conversions are kept on disk
- `FFMPEG_PATH`: optional explicit path to the `ffmpeg` binary
- `YTDLP_PATH`: optional explicit path to the `yt-dlp` binary

### Run

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Production deployment

This app is not a good fit for serverless hosting because it needs:

- long-running conversion jobs
- writable local disk
- `yt-dlp` and `ffmpeg`

Use a VPS or VM instead.

## Docker

The repo includes a production `Dockerfile` that installs `ffmpeg` and `yt-dlp`, builds the app, and runs it on port `3000`.

## Docker Compose

The repo also includes `compose.yaml` so the app can be started with persistent local storage for converted files.

### Prepare production env

```bash
cp .env.example .env.production
```

### Start with Compose

```bash
docker compose up -d --build
```

### Stop

```bash
docker compose down
```

### Build

```bash
docker build -t youtube-media .
```

### Run

```bash
docker run -d \
  --name youtube-media \
  --restart unless-stopped \
  -p 3000:3000 \
  --env-file .env.production \
  youtube-media
```

Example `.env.production`:

```env
MAX_ACTIVE_JOBS=2
JOB_RETENTION_HOURS=2
MAX_STORED_COMPLETED_JOBS=2
```

## Oracle Cloud Free guide

Recommended setup for Oracle Free:

1. Create an `Always Free` compute instance.
2. Choose an `Ampere A1` shape if available.
3. Install Docker on the VM.
4. Clone this repo from GitHub.
5. Build and run the container.
6. Open the application port in the instance security rules.

### Suggested Oracle sizing

- `2 OCPUs`
- `12 GB RAM`
- keep `MAX_ACTIVE_JOBS=2`
- keep `MAX_STORED_COMPLETED_JOBS=2`

That keeps the app in a safer range for a free-tier VM.

### VM commands

```bash
git clone <your-repo-url>
cd YouTube-Media
cp .env.example .env.production
docker compose up -d --build
```

## GitHub checklist

Before pushing:

- confirm `.env.local` is not committed
- confirm `storage/` output files are not committed
- confirm `vendor/` is not committed

Then:

```bash
git add .
git commit -m "Prepare app for Oracle Cloud deployment"
```

## Notes

- The app keeps job state in memory and stores generated files on local disk.
- Completed job files are cleaned up automatically based on `JOB_RETENTION_HOURS`.
- The server also keeps only the newest `MAX_STORED_COMPLETED_JOBS` finished conversions.
- In production, keep concurrency low unless you move conversion to a separate worker system.
