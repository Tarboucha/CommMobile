import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { Server as SocketIOServer } from 'socket.io'
import { authenticateSocket } from './src/lib/socket'
import { PgNotifyManager } from './src/lib/pg-notify/pg-notify-manager'
import { registerListeners } from './src/lib/pg-notify/listeners'
import type { AuthenticatedSocket } from './src/types/socket'

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || 'localhost'
const port = parseInt(process.env.PORT || '3002', 10)

async function startServer() {
  // 1. Create Next.js app
  const app = next({ dev, hostname, port })
  const handle = app.getRequestHandler()

  await app.prepare()

  // 2. Create HTTP server
  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error handling request:', err)
      res.statusCode = 500
      res.end('Internal server error')
    }
  })

  // 3. Create Socket.io server
  const io = new SocketIOServer(server, {
    cors: {
      origin: '*', // IMPORTANT: Restrict in production!
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  })

  console.log('[Socket.io] Initializing server...')

  // 4. Apply authentication middleware
  io.use(authenticateSocket)

  // 5. Handle connections
  io.on('connection', (socket) => {
    const authSocket = socket as AuthenticatedSocket

    console.log(`[Socket.io] ✅ Client connected: ${socket.id} → User ${authSocket.userId}`)

    // Join user-specific room
    const userRoom = `user:${authSocket.userId}`
    authSocket.join(userRoom)
    console.log(`[Socket.io] User ${authSocket.userId} joined room: ${userRoom}`)

    // Send connection confirmation
    authSocket.emit('connected', {
      socketId: authSocket.id,
      userId: authSocket.userId,
      timestamp: Date.now(),
    })

    // Join a community chat room
    authSocket.on('join:community', (communityId: string) => {
      const room = `community:${communityId}`
      authSocket.join(room)
      console.log(`[Socket.io] User ${authSocket.userId} joined room: ${room}`)
    })

    // Leave a community chat room
    authSocket.on('leave:community', (communityId: string) => {
      const room = `community:${communityId}`
      authSocket.leave(room)
      console.log(`[Socket.io] User ${authSocket.userId} left room: ${room}`)
    })

    // Join a booking chat room
    authSocket.on('join:booking', (bookingId: string) => {
      const room = `booking:${bookingId}`
      authSocket.join(room)
      console.log(`[Socket.io] User ${authSocket.userId} joined room: ${room}`)
    })

    // Leave a booking chat room
    authSocket.on('leave:booking', (bookingId: string) => {
      const room = `booking:${bookingId}`
      authSocket.leave(room)
      console.log(`[Socket.io] User ${authSocket.userId} left room: ${room}`)
    })

    // Join a direct conversation room
    authSocket.on('join:conversation', (conversationId: string) => {
      const room = `conversation:${conversationId}`
      authSocket.join(room)
      console.log(`[Socket.io] User ${authSocket.userId} joined room: ${room}`)
    })

    // Leave a direct conversation room
    authSocket.on('leave:conversation', (conversationId: string) => {
      const room = `conversation:${conversationId}`
      authSocket.leave(room)
      console.log(`[Socket.io] User ${authSocket.userId} left room: ${room}`)
    })

    // Handle disconnect
    authSocket.on('disconnect', (reason) => {
      console.log(`[Socket.io] ❌ Client disconnected: ${socket.id} → Reason: ${reason}`)
    })

    // Handle errors
    authSocket.on('error', (error) => {
      console.error(`[Socket.io] ⚠️ Socket error for ${socket.id}:`, error)
    })
  })

  // 6. Initialize PgNotifyManager
  const pgManager = new PgNotifyManager(io)

  // 7. Register listeners
  registerListeners(pgManager)

  // 8. Connect PgNotifyManager
  try {
    await pgManager.connect()
    console.log('[PgNotifyManager] ✅ Connected and listening to PostgreSQL NOTIFY events')
  } catch (err) {
    console.error('[PgNotifyManager] ❌ Connection failed:', err)
    console.error('[PgNotifyManager] Real-time notifications will not work!')
  }

  // 9. Start HTTP server
  server.listen(port, () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`🚀 Server ready on http://${hostname}:${port}`)
    console.log(`📡 Socket.io enabled and listening`)
    console.log(`🔔 Real-time notifications active`)
    console.log(`🌍 Environment: ${dev ? 'development' : 'production'}`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  })

  // 10. Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n${signal} received, shutting down gracefully...`)

    let cleanShutdown = true

    // Close Socket.io connections
    io.close(() => {
      console.log('[Socket.io] All connections closed')
    })

    // Disconnect PgNotifyManager with timeout and fallback to force close
    try {
      await pgManager.disconnect()
      console.log('[PgNotifyManager] Disconnected')
    } catch (err) {
      console.error('[PgNotifyManager] Graceful disconnect failed:', err)
      cleanShutdown = false

      // Force close the connection as fallback
      try {
        pgManager.forceClose()
        console.log('[PgNotifyManager] Forced connection close successful')
      } catch (forceErr) {
        console.error('[PgNotifyManager] Failed to force close:', forceErr)
      }
    }

    // Close HTTP server
    server.close(() => {
      console.log('[Server] HTTP server closed')
      process.exit(cleanShutdown ? 0 : 1)
    })

    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      console.error('[Server] Forcefully shutting down after timeout')
      process.exit(1)
    }, 10000)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  // Handle uncaught errors
  process.on('uncaughtException', (err) => {
    console.error('[Server] Uncaught exception:', err)
    shutdown('UNCAUGHT_EXCEPTION')
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Server] Unhandled rejection at:', promise, 'reason:', reason)
  })
}

// Start the server
startServer().catch((err) => {
  console.error('[Server] Failed to start:', err)
  process.exit(1)
})
