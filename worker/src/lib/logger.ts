/**
 * Tiny structured logger. Writes one JSON line per event to stdout.
 * Keeps Docker logs greppable without pulling in pino/winston.
 */

type Level = 'info' | 'warn' | 'error'

function emit(level: Level, msg: string, fields?: Record<string, unknown>) {
  const line = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...fields,
  }
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(line))
}

export const log = {
  info: (msg: string, fields?: Record<string, unknown>) => emit('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => emit('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => emit('error', msg, fields),
}
