import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { createClient } from 'redis'
import { createAdapter } from '@socket.io/redis-adapter'
import { authenticateSocket } from './auth'
import { PgNotifyManager } from './pg-notify/pg-notify-manager'
import { registerListeners } from './pg-notify/listeners'
import type { AuthenticatedSocket } from './types/socket'
import { log } from './log'
import { register, socketActiveConnections, socketConnectionsTotal } from './metrics'

const PORT = parseInt(process.env.PORT || '3001', 10)
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0'
const METRICS_PORT = parseInt(process.env.METRICS_PORT || '9103', 10)

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

  pubClient.on('error', (err) => log.error({ err, role: 'pub' }, 'redis client error'))
  subClient.on('error', (err) => log.error({ err, role: 'sub' }, 'redis client error'))

  await Promise.all([pubClient.connect(), subClient.connect()])
  log.info('redis connected')

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
  const ioLog = log.child({ component: 'socket.io' })
  io.on('connection', (socket) => {
    const authSocket = socket as AuthenticatedSocket

    socketActiveConnections.inc()
    socketConnectionsTotal.inc()

    ioLog.info({ socketId: socket.id, userId: authSocket.userId }, 'socket connected')

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
      ioLog.debug({ userId: authSocket.userId, communityId: id }, 'joined community room')
    })
    authSocket.on('leave:community', (id: string) => authSocket.leave(`community:${id}`))

    authSocket.on('join:booking', (id: string) => {
      authSocket.join(`booking:${id}`)
      ioLog.debug({ userId: authSocket.userId, bookingId: id }, 'joined booking room')
    })
    authSocket.on('leave:booking', (id: string) => authSocket.leave(`booking:${id}`))

    authSocket.on('join:conversation', (id: string) => {
      authSocket.join(`conversation:${id}`)
      ioLog.debug({ userId: authSocket.userId, conversationId: id }, 'joined conversation room')
    })
    authSocket.on('leave:conversation', (id: string) => authSocket.leave(`conversation:${id}`))

    authSocket.on('disconnect', (reason) => {
      socketActiveConnections.dec()
      ioLog.info({ socketId: socket.id, reason }, 'socket disconnected')
    })

    authSocket.on('error', (err) => {
      ioLog.error({ err, socketId: socket.id }, 'socket error')
    })
  })

  // 6. PgNotifyManager — PostgreSQL LISTEN/NOTIFY → Socket.io broadcast
  const pgManager = new PgNotifyManager(io)
  registerListeners(pgManager)

  try {
    await pgManager.connect()
    log.info('pg-notify listening for postgres NOTIFY events')
  } catch (err) {
    log.error({ err }, 'pg-notify connection failed — real-time will not work')
  }

  // 7. Start listening
  httpServer.listen(PORT, HOSTNAME, () => {
    log.info({
      port: PORT,
      host: HOSTNAME,
      redisAdapter: true,
      pgNotify: true,
    }, 'socket-server ready')
  })

  // 8. Metrics server on internal-only port (not published in compose)
  const metricsServer = createServer((req, res) => {
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

  // 9. Graceful shutdown
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'shutdown signal received')

    io.close(() => ioLog.info('all socket connections closed'))
    metricsServer.close()

    try {
      await pgManager.disconnect()
    } catch {
      pgManager.forceClose()
    }

    await pubClient.quit()
    await subClient.quit()
    log.info('redis disconnected')

    httpServer.close(() => {
      log.info('http server closed')
      process.exit(0)
    })

    setTimeout(() => {
      log.error('forceful shutdown after timeout')
      process.exit(1)
    }, 10000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('uncaughtException', (err) => {
    log.fatal({ err }, 'uncaught exception')
    shutdown('UNCAUGHT_EXCEPTION')
  })
  process.on('unhandledRejection', (reason) => {
    log.error({ reason }, 'unhandled promise rejection')
  })
}

startServer().catch((err) => {
  log.fatal({ err }, 'socket-server failed to start')
  process.exit(1)
})
