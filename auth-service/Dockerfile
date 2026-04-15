FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile 2>/dev/null || pnpm install

COPY . .

# ── Production image ─────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache wget
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN addgroup -S kodo && adduser -S kodo -G kodo

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/src ./src
COPY --from=builder /app/sql ./sql

USER kodo

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=5s --retries=3 --start-period=10s \
  CMD wget --spider -q http://localhost:3004/health || exit 1

CMD ["npx", "tsx", "src/index.ts"]
