import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

/**
 * Single pino instance used everywhere in auth-service.
 *
 * - In module-scope code (db.ts, early main() crashes): import `log` directly.
 * - Inside Fastify routes/hooks: use `req.log` (child logger, pre-tagged with
 *   request ID). It's the SAME underlying pino instance — Fastify receives
 *   this object via `loggerInstance` in index.ts, so config lives in one place.
 */
export const log = pino({
  level: process.env.LOG_LEVEL || 'info',

  // Dev: human-readable colored output. Prod: raw JSON for Loki.
  transport: isDev
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      }
    : undefined,

  // Never let these fields reach logs — passwords, tokens, auth headers.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.current_password',
      'req.body.new_password',
      'req.body.token',
      'req.body.refresh_token',
    ],
    censor: '[REDACTED]',
  },
})
