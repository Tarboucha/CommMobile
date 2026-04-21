import { pool } from './lib/db.js'
import { startScheduler } from './schedules/cron.js'
import { log } from './lib/logger.js'

async function main() {
  log.info('worker booting')

  // Sanity check: can we reach the DB?
  await pool.query('SELECT 1')
  log.info('db reachable')

  startScheduler()

  // Optional: run jobs immediately on startup if WORKER_RUN_ON_BOOT is set.
  // Useful for ad-hoc cleanup runs (`docker compose run worker`).
  if (process.env.WORKER_RUN_ON_BOOT === 'true') {
    const { expireAttachments } = await import('./jobs/expire-attachments.js')
    const { orphanSweep } = await import('./jobs/orphan-sweep.js')
    log.info('WORKER_RUN_ON_BOOT=true — running all jobs now')
    await expireAttachments().catch((err) => log.error({ err }, 'expire-attachments failed'))
    await orphanSweep().catch((err) => log.error({ err }, 'orphan-sweep failed'))
  }

  log.info('worker ready')

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down')
    await pool.end()
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  log.fatal({ err }, 'worker failed to start')
  process.exit(1)
})
