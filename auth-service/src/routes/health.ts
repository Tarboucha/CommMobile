import type { FastifyInstance } from 'fastify'
import { pool } from '../db.js'

export async function healthRoutes(fastify: FastifyInstance) {
  // `logLevel: 'warn'` silences Fastify's info-level auto-logs for this
  // route (incoming request / request completed). Healthchecks fire every
  // 30s per container — without this, they'd dominate the log volume.
  //
  // The Docker HEALTHCHECK mechanism is unaffected — it's an HTTP probe
  // that checks the response code, not logs. Container still reports
  // healthy/unhealthy based on the 200/503 returned below.
  //
  // Failures explicitly log at warn level so real issues (DB down) still
  // surface in Loki/dashboards/alerts.
  fastify.get('/health', { logLevel: 'warn' }, async (req, reply) => {
    try {
      await pool.query('SELECT 1')
      return reply.send({ status: 'ok' })
    } catch (err) {
      req.log.warn({ err }, 'health check failed — DB query rejected')
      return reply.status(503).send({ status: 'unhealthy' })
    }
  })
}
