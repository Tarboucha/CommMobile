# =============================================================================
# Stage 1: Dependencies Installation
# =============================================================================
FROM node:24-alpine AS deps

WORKDIR /app

# Copy package management files
COPY package.json package-lock.json* ./

# Install dependencies with frozen lockfile for reproducible builds
RUN npm ci --prefer-offline

# =============================================================================
# Stage 2: Application Builder
# =============================================================================
FROM node:24-alpine AS builder

WORKDIR /app

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy all source code
COPY . .

# Build-time config
ARG NODE_MEMORY_LIMIT=2048
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build the application (env vars are injected at runtime via env_file, not needed at build time)
RUN NODE_OPTIONS="--max-old-space-size=${NODE_MEMORY_LIMIT}" npm run build

# =============================================================================
# Stage 3: Production Runner
# =============================================================================
FROM node:24-alpine AS runner

WORKDIR /app

# Update Alpine packages for security
RUN apk update && apk upgrade --available --no-cache

# Set production environment
ENV NODE_ENV=production
ENV PORT=3002
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder stage
COPY --from=builder --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/custom-server.ts ./custom-server.ts

# Switch to non-root user
USER nextjs

# Expose application port (internal only)
# Port 3002 handles both HTTP and WebSocket (Socket.io)
EXPOSE 3002

# Start the custom server with Socket.io support
CMD ["node_modules/.bin/tsx", "custom-server.ts"]
