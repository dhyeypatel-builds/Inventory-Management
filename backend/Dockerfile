ARG NODE_VERSION=22

# ── Stage 1: Dependencies ──────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json* ./
COPY prisma ./prisma

RUN npm ci --ignore-scripts

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npm run build && npx prisma generate

# ── Stage 3: Runner (production) ───────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Chromium for branded-PDF rendering (Phase 2D). Use the system browser instead of
# puppeteer's bundled download; fonts incl. the £ glyph + Noto for broad coverage.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto
ENV CHROME_PATH=/usr/bin/chromium-browser

# Only copy what's needed at runtime
COPY --from=deps    /app/node_modules          ./node_modules
COPY --from=builder /app/dist                  ./dist
COPY --from=builder /app/prisma                ./prisma
COPY --from=builder /app/node_modules/.prisma  ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma  ./node_modules/@prisma

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

EXPOSE 3001
