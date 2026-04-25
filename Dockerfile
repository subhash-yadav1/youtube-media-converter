FROM node:18-bullseye AS builder

# Install build tools and python/pip (for yt-dlp if needed during build)
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  python3-pip \
  ca-certificates \
  curl \
  build-essential \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies and build
COPY package*.json ./
RUN npm ci

COPY . ./
RUN npm run build
RUN npm prune --production || true

FROM node:18-bullseye-slim AS runner

# Install runtime deps and ffmpeg + yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
  python3 \
  python3-pip \
  ffmpeg \
  ca-certificates \
  curl \
  && pip3 install --no-cache-dir yt-dlp \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy build artifacts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 8080

CMD ["npm", "run", "start"]
FROM node:22-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV MAX_ACTIVE_JOBS=2
ENV JOB_RETENTION_HOURS=2

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 python3-pip ca-certificates \
  && pip3 install --no-cache-dir --break-system-packages yt-dlp \
  && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

COPY package.json package-lock.json ./
COPY --from=deps /app/node_modules ./node_modules
RUN npm prune --omit=dev

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/next.config.ts ./next.config.ts

RUN mkdir -p /app/storage/jobs \
  && chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["npm", "run", "start"]
