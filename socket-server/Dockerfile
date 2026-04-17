# =============================================================================
# KoDo Socket Server — Docker Build
#
# Standalone Socket.io service with PgNotifyManager + Redis adapter.
# No Next.js dependency — pure Node.js.
# =============================================================================

# ─── Stage 1: Install dependencies ───────────────────────────────────────────
FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --frozen-lockfile

# ─── Stage 2: Production runner ───────────────────────────────────────────────
FROM node:22-alpine AS runner

RUN apk update && apk upgrade --available --no-cache && apk add --no-cache wget
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

# Non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 socketuser

# Install tsx for TypeScript execution
RUN npm install -g tsx

# Copy dependencies + source
COPY --from=deps --chown=socketuser:nodejs /app/node_modules ./node_modules
COPY --chown=socketuser:nodejs . .

USER socketuser

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=15s \
  CMD wget --spider -q http://localhost:3001/health || exit 1

CMD ["tsx", "src/index.ts"]
