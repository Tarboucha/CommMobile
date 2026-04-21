import { Cron } from 'croner'
import { expireAttachments } from '../jobs/expire-attachments.js'
import { orphanSweep } from '../jobs/orphan-sweep.js'
import { log } from '../lib/logger.js'

/**
 * Wraps a job with logging + crash protection so a single bad run never
 * takes down the worker.
 */
function safe(name: string, fn: () => Promise<unknown>) {
  const jobLog = log.child({ job: name })
  return async () => {
    const startedAt = Date.now()
    jobLog.info('job starting')
    try {
      const result = await fn()
      jobLog.info({ result, durationMs: Date.now() - startedAt }, 'job finished')
    } catch (err) {
      jobLog.error({ err, durationMs: Date.now() - startedAt }, 'job crashed')
    }
  }
}

export function startScheduler() {
  // Hourly: delete expired message attachments.
  new Cron('0 * * * *', safe('expire-attachments', expireAttachments))

  // Sunday 03:00: walk R2 and delete orphan keys.
  new Cron('0 3 * * 0', safe('orphan-sweep', orphanSweep))

  log.info({
    jobs: ['expire-attachments (hourly)', 'orphan-sweep (Sun 03:00)'],
  }, 'scheduler started')
}
