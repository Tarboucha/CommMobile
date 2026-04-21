import { Cron } from 'croner'
import { expireAttachments } from '../jobs/expire-attachments.js'
import { orphanSweep } from '../jobs/orphan-sweep.js'
import { log } from '../lib/logger.js'
import { jobRunsTotal, jobDuration } from '../lib/metrics.js'

/**
 * Wraps a job with logging + metrics + crash protection so a single bad run
 * never takes down the worker.
 */
function safe(name: string, fn: () => Promise<unknown>) {
  const jobLog = log.child({ job: name })
  return async () => {
    const startedAt = Date.now()
    jobLog.info('job starting')
    try {
      const result = await fn()
      const durationSec = (Date.now() - startedAt) / 1000
      jobLog.info({ result, durationMs: durationSec * 1000 }, 'job finished')

      jobRunsTotal.inc({ job: name, status: 'success' })
      jobDuration.observe({ job: name }, durationSec)
    } catch (err) {
      const durationSec = (Date.now() - startedAt) / 1000
      jobLog.error({ err, durationMs: durationSec * 1000 }, 'job crashed')

      jobRunsTotal.inc({ job: name, status: 'failed' })
      jobDuration.observe({ job: name }, durationSec)
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
