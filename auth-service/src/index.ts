import Fastify from 'fastify'
import cors from '@fastify/cors'
import http from 'http'
import { pool } from './db.js'
import { loadKeys } from './keys.js'
import { log } from './log.js'
import { register, httpRequestsTotal, httpRequestDuration } from './metrics.js'
import { jwksRoutes } from './routes/jwks.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'

const PORT = parseInt(process.env.PORT || '3004')
const HOST = process.env.HOST || '0.0.0.0'
const METRICS_PORT = parseInt(process.env.METRICS_PORT || '9101')

async function main() {
  // Pass the shared pino instance so `fastify.log` and `req.log` use the
  // SAME logger as `log` from './log.js'. Config lives only in log.ts.
  const fastify = Fastify({ loggerInstance: log })

  // ─── Metrics: record every request (healthchecks don't log but still count) ──
  fastify.addHook('onResponse', async (request, reply) => {
    const route = request.routeOptions?.url || 'unknown'
    const method = request.method
    const status = String(reply.statusCode)
    const durationSec = reply.elapsedTime / 1000

    httpRequestsTotal.inc({ method, route, status })
    httpRequestDuration.observe({ method, route, status }, durationSec)
  })

  // Pre-load keys (generates if first run)
  await loadKeys()
  fastify.log.info('EC key pair loaded')

  // Run schema migration
  const schemaSQL = await import('fs').then(fs =>
    fs.readFileSync(new URL('../sql/001_auth_schema.sql', import.meta.url), 'utf-8')
  )
  await pool.query(schemaSQL)
  fastify.log.info('schema migration applied')

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  })

  // Register routes
  await fastify.register(jwksRoutes)
  await fastify.register(healthRoutes)
  await fastify.register(authRoutes)

  await fastify.listen({ port: PORT, host: HOST })
  fastify.log.info({ port: PORT, host: HOST }, 'auth-service listening')

  // ─── Separate /metrics server on internal-only port (not in compose `ports`) ──
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
    fastify.log.info({ port: METRICS_PORT }, 'metrics server listening (internal only)')
  })

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    fastify.log.info({ signal }, 'shutdown signal received')
    metricsServer.close()
    await fastify.close()
    await pool.end()
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  // Fastify logger not available yet if main() throws early — use top-level logger.
  log.fatal({ err }, 'auth-service failed to start')
  process.exit(1)
})
