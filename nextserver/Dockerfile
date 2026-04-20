# =============================================================================
# KoDo API — Multi-stage Docker Build
#
# Uses Node 22 LTS on Alpine. Standard Next.js server.
#
# Build: docker build -t kodo-api .
# Run:   docker run -p 3002:3002 --env-file .env kodo-api
# =============================================================================

# =============================================================================
# Stage 1: Install dependencies (cached unless package.json/lockfile change)
# =============================================================================
FROM node:22-alpine AS deps

RUN corepack enable pnpm
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# =============================================================================
# Stage 2: Build application
# =============================================================================
FROM node:22-alpine AS build

RUN corepack enable pnpm
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Prisma 7 requires DATABASE_URL even for `prisma generate` and `next build`,
# though neither actually connects. Dummy URL satisfies env("DATABASE_URL").
ENV DATABASE_URL=postgresql://dummy:dummy@localhost:5432/dummy
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN pnpm build

# =============================================================================
# Stage 3: Production runner (minimal image)
# =============================================================================
FROM node:22-alpine AS runner

RUN apk update && apk upgrade --available --no-cache && apk add --no-cache wget
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=build --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nextjs:nodejs /app/.next ./.next
COPY --from=build --chown=nextjs:nodejs /app/package.json ./
COPY --from=build --chown=nextjs:nodejs /app/src ./src
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma

USER nextjs

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=30s \
  CMD wget --spider -q http://localhost:3002/api/v1/health || exit 1

CMD ["npx", "next", "start", "-p", "3002", "-H", "0.0.0.0"]
