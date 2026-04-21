import http from 'http'
import { pool } from './lib/db.js'
import { startScheduler } from './schedules/cron.js'
import { log } from './lib/logger.js'
import { register } from './lib/metrics.js'

const METRICS_PORT = parseInt(process.env.METRICS_PORT || '9104')

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

  // ─── Metrics server on internal-only port (not published in compose) ──
  const metricsServer = http.createServer((req, res) => {
    if (req.url === '/metrics') {
      register.metrics()
        .then((m) => {
          res.writeHead(200, { 'Content-Type': register.contentType })
          res.end(m)
        })
        .catch((err) => {
          res.writeHead(500)
          res.end(String(err))
        })
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  metricsServer.listen(METRICS_PORT, '0.0.0.0', () => {
    log.info({ port: METRICS_PORT }, 'metrics server listening (internal only)')
  })

  log.info('worker ready')

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutting down')
    metricsServer.close()
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
