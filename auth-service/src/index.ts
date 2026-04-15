import Fastify from 'fastify'
import cors from '@fastify/cors'
import { pool } from './db.js'
import { loadKeys } from './keys.js'
import { jwksRoutes } from './routes/jwks.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'

const PORT = parseInt(process.env.PORT || '3004')
const HOST = process.env.HOST || '0.0.0.0'

async function main() {
  // Pre-load keys (generates if first run)
  await loadKeys()
  console.log('[Auth] EC key pair loaded')

  // Run schema migration
  const schemaSQL = await import('fs').then(fs =>
    fs.readFileSync(new URL('../sql/001_auth_schema.sql', import.meta.url), 'utf-8')
  )
  await pool.query(schemaSQL)
  console.log('[Auth] Schema migration applied')

  const fastify = Fastify({ logger: false })

  await fastify.register(cors, {
    origin: true,
    credentials: true,
  })

  // Register routes
  await fastify.register(jwksRoutes)
  await fastify.register(healthRoutes)
  await fastify.register(authRoutes)

  await fastify.listen({ port: PORT, host: HOST })
  console.log(`[Auth] Listening on http://${HOST}:${PORT}`)

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[Auth] ${signal} received, shutting down...`)
    await fastify.close()
    await pool.end()
    process.exit(0)
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main().catch((err) => {
  console.error('[Auth] Fatal:', err)
  process.exit(1)
})
