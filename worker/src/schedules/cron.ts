import { Cron } from 'croner'
import { expireAttachments } from '../jobs/expire-attachments.js'
import { orphanSweep } from '../jobs/orphan-sweep.js'
import { log } from '../lib/logger.js'

/**
 * Wraps a job with logging + crash protection so a single bad run never
 * takes down the worker.
 */
function safe(name: string, fn: () => Promise<unknown>) {
  return async () => {
    log.info(`job ${name} starting`)
    try {
      const result = await fn()
      log.info(`job ${name} finished`, { result })
    } catch (err) {
      log.error(`job ${name} crashed`, {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      })
    }
  }
}

export function startScheduler() {
  // Hourly: delete expired message attachments.
  new Cron('0 * * * *', safe('expire-attachments', expireAttachments))

  // Sunday 03:00: walk R2 and delete orphan keys.
  new Cron('0 3 * * 0', safe('orphan-sweep', orphanSweep))

  log.info('scheduler started', {
    jobs: ['expire-attachments (hourly)', 'orphan-sweep (Sun 03:00)'],
  })
}
