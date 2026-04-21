import pino from 'pino'

const isDev = process.env.NODE_ENV !== 'production'

/**
 * Shared pino logger for socket-server.
 *
 * Use child loggers to add persistent context:
 *   const subLog = log.child({ component: 'pg-notify' })
 *   subLog.info({ channel }, 'listening')
 */
export const log = pino({
  level: process.env.LOG_LEVEL || 'info',
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
})
