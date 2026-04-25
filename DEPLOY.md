# Deploying YouTube Media (Docker + Fly.io)

This guide shows how to deploy the full Next.js app (frontend + server API routes) as a Docker container on Fly.io. This approach allows running native binaries (`yt-dlp`, `ffmpeg`) required by the backend.

1) Build & run locally (quick smoke test)

```bash
# build the docker image
docker build -t youtube-media-app .

# run the container locally, mapping port 8080
docker run --rm -p 8080:8080 \
  -e NEXT_PUBLIC_SITE_URL=http://localhost:8080 \
  youtube-media-app

# open http://localhost:8080
```

2) Deploy to Fly.io

- Install `flyctl`: https://fly.io/docs/getting-started/installing-flyctl/
- Login: `flyctl auth login`

Initialize and deploy:

```bash
# create or select an app name (you can change fly.toml app.name first)
flyctl launch --name youtube-media-app --no-deploy

# deploy using the Dockerfile
flyctl deploy

# optionally set the public site URL (used for Open Graph, sitemap etc.)
flyctl secrets set NEXT_PUBLIC_SITE_URL=https://<your-app>.fly.dev
```

3) Notes & follow-ups

- Fly.io will provide a subdomain like `your-app.fly.dev`. Replace `https://your-domain.com` in `public/robots.txt` and `public/sitemap.xml` or set `NEXT_PUBLIC_SITE_URL`.
- If you prefer to host only the frontend on Vercel and run backend separately, create a small backend Docker service that exposes only the API routes and set `NEXT_PUBLIC_API_BASE_URL` in Vercel to the backend URL.
- Monitor resource usage: video conversions can be CPU and bandwidth intensive. Consider rate limiting or queue size limits in `serverConfig` before opening to public traffic.
