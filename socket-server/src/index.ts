import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { createClient } from 'redis'
import { createAdapter } from '@socket.io/redis-adapter'
import { authenticateSocket } from './auth'
import { PgNotifyManager } from './pg-notify/pg-notify-manager'
import { registerListeners } from './pg-notify/listeners'
import type { AuthenticatedSocket } from './types/socket'

const PORT = parseInt(process.env.PORT || '3001', 10)
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0'

async function startServer() {
  // 1. HTTP server — health check only, no framework needed
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        status: 'healthy',
        uptime: process.uptime(),
        service: 'kodo-socket-server',
      }))
      return
    }
    res.writeHead(404)
    res.end()
  })

  // 2. Redis adapter — enables multi-pod Socket.io (events reach any pod)
  const pubClient = createClient({ url: process.env.REDIS_URL || 'redis://redis:6379' })
  const subClient = pubClient.duplicate()

  pubClient.on('error', (err) => console.error('[Redis] pub error:', err))
  subClient.on('error', (err) => console.error('[Redis] sub error:', err))

  await Promise.all([pubClient.connect(), subClient.connect()])
  console.log('[Redis] ✅ Connected')

  // 3. Socket.io server with Redis adapter
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*', // Restrict in production via env var
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    adapter: createAdapter(pubClient, subClient),
  })

  // 4. Auth middleware — local JWT validation, no call to kodo-api
  io.use(authenticateSocket)

  // 5. Connection handlers
  io.on('connection', (socket) => {
    const authSocket = socket as AuthenticatedSocket

    console.log(`[Socket.io] ✅ Connected: ${socket.id} → User ${authSocket.userId}`)

    // Join personal room for notifications
    authSocket.join(`user:${authSocket.userId}`)

    authSocket.emit('connected', {
      socketId: authSocket.id,
      userId: authSocket.userId,
      timestamp: Date.now(),
    })

    // Room management
    authSocket.on('join:community', (id: string) => {
      authSocket.join(`community:${id}`)
      console.log(`[Socket.io] User ${authSocket.userId} joined community:${id}`)
    })
    authSocket.on('leave:community', (id: string) => authSocket.leave(`community:${id}`))

    authSocket.on('join:booking', (id: string) => {
      authSocket.join(`booking:${id}`)
      console.log(`[Socket.io] User ${authSocket.userId} joined booking:${id}`)
    })
    authSocket.on('leave:booking', (id: string) => authSocket.leave(`booking:${id}`))

    authSocket.on('join:conversation', (id: string) => {
      authSocket.join(`conversation:${id}`)
      console.log(`[Socket.io] User ${authSocket.userId} joined conversation:${id}`)
    })
    authSocket.on('leave:conversation', (id: string) => authSocket.leave(`conversation:${id}`))

    authSocket.on('disconnect', (reason) => {
      console.log(`[Socket.io] ❌ Disconnected: ${socket.id} → ${reason}`)
    })

    authSocket.on('error', (error) => {
      console.error(`[Socket.io] ⚠️ Error for ${socket.id}:`, error)
    })
  })

  // 6. PgNotifyManager — PostgreSQL LISTEN/NOTIFY → Socket.io broadcast
  const pgManager = new PgNotifyManager(io)
  registerListeners(pgManager)

  try {
    await pgManager.connect()
    console.log('[PgNotifyManager] ✅ Listening to PostgreSQL NOTIFY events')
  } catch (err) {
    console.error('[PgNotifyManager] ❌ Connection failed — real-time will not work:', err)
  }

  // 7. Start listening
  httpServer.listen(PORT, HOSTNAME, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`📡 Socket server ready on http://${HOSTNAME}:${PORT}`)
    console.log(`🔌 Redis adapter active`)
    console.log(`🔔 PgNotify listeners active`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  })

  // 8. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down...`)

    io.close(() => console.log('[Socket.io] All connections closed'))

    try {
      await pgManager.disconnect()
      console.log('[PgNotifyManager] Disconnected')
    } catch {
      pgManager.forceClose()
      console.log('[PgNotifyManager] Force closed')
    }

    await pubClient.quit()
    await subClient.quit()
    console.log('[Redis] Disconnected')

    httpServer.close(() => {
      console.log('[Server] Closed')
      process.exit(0)
    })

    setTimeout(() => {
      console.error('[Server] Forceful shutdown after timeout')
      process.exit(1)
    }, 10000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception:', err)
    shutdown('UNCAUGHT_EXCEPTION')
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[Server] Unhandled rejection:', reason)
  })
}

startServer().catch((err) => {
  console.error('[Server] Failed to start:', err)
  process.exit(1)
})
