ARG NODE_VERSION=22

# Build context is the REPO ROOT (npm workspaces — the lockfile lives there):
#   docker build -f backend/Dockerfile --target runner .

# ── Stage 1: Dependencies ──────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app

# Prisma's engines need libssl (openssl 3.x on Alpine) — without it the schema
# engine fails to load and migrate/generate error out.
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY backend/package.json ./backend/
COPY backend/prisma ./backend/prisma

RUN npm ci --ignore-scripts -w backend

# ── Stage 2: Build ─────────────────────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app

# libssl for the Prisma engine invoked by `prisma generate` below.
RUN apk add --no-cache openssl

# Workspace deps hoist to /app/node_modules EXCEPT where versions conflict
# across workspaces (e.g. puppeteer-core) — those land in backend/node_modules,
# so both trees must come along.
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/backend/node_modules ./backend/node_modules
COPY --from=deps /app/package.json ./package.json
COPY backend ./backend

# Generate the Prisma client BEFORE tsc — deps were installed with
# --ignore-scripts, so the postinstall generate never ran and @prisma/client
# has no types until we do.
RUN npx prisma generate --schema backend/prisma/schema.prisma \
 && npm run build -w backend

# ── Stage 3: Runner (production) ───────────────────────────────────────────────
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Chromium for branded-PDF rendering (Phase 2D). Use the system browser instead of
# puppeteer's bundled download; fonts incl. the £ glyph + Noto for broad coverage.
RUN apk add --no-cache \
      openssl \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto
ENV CHROME_PATH=/usr/bin/chromium-browser

# Only copy what's needed at runtime. The un-hoisted backend/node_modules
# overlay is merged INTO ./node_modules so `node dist/index.js` resolves both.
COPY --from=deps    /app/node_modules          ./node_modules
COPY --from=deps    /app/backend/node_modules  ./node_modules
COPY --from=builder /app/backend/dist          ./dist
COPY --from=builder /app/backend/prisma        ./prisma
COPY --from=builder /app/node_modules/.prisma  ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma  ./node_modules/@prisma

# Run migrations then start
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]

EXPOSE 3001
