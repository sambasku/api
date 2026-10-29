# syntax=docker/dockerfile:1.7
# Staging/homelab runtime untuk src/main.ts (Node + Hono).
# Bukan entry Workers (src/worker.ts). Tag base PINNED - jangan :latest.
# Acuan: docs/api/DOCKERIZE_STAGING_HOMELAB.md

ARG NODE_VERSION=22.14.0

# --- deps: install production node_modules ---
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

COPY package.json pnpm-lock.yaml ./
# tsx ada di dependencies - cukup prod untuk pnpm start
RUN pnpm install --frozen-lockfile --prod

# --- runtime ---
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=staging \
    PORT=8181 \
    # Jangan tulis file sebagai root
    HOME=/home/node

RUN apk add --no-cache curl \
  && corepack enable \
  && corepack prepare pnpm@9.15.9 --activate

# --chown wajib: USER node di bawah; tanpa ini file root-owned → runtime gagal
COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json pnpm-lock.yaml tsconfig.json ./
COPY --chown=node:node src ./src

# Image resmi node menyediakan user `node` (uid 1000)
USER node

EXPOSE 8181

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:${PORT}/health" || exit 1

CMD ["pnpm", "start"]
