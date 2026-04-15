import type { FastifyInstance } from 'fastify'
import { pool } from '../db.js'

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async (_req, reply) => {
    try {
      await pool.query('SELECT 1')
      return reply.send({ status: 'ok' })
    } catch {
      return reply.status(503).send({ status: 'unhealthy' })
    }
  })
}
