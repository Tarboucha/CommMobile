// src/lib/pg-notify/pg-notify-manager.ts
// Core PostgreSQL NOTIFY/LISTEN manager
// Manages a single PG connection and routes notifications to registered handlers
// Note: This is NOT Supabase Realtime - it's our custom PostgreSQL NOTIFY/LISTEN implementation

import { Client } from 'pg'
import type { Server as SocketIOServer } from 'socket.io'

// Generic payload type for PostgreSQL NOTIFY events
export interface PgNotifyPayload {
  [key: string]: unknown
}

export type NotificationHandler<T extends PgNotifyPayload = PgNotifyPayload> = (
  payload: T,
  io: SocketIOServer,
) => void | Promise<void>

/**
 * Manages PostgreSQL NOTIFY/LISTEN for real-time events
 *
 * Design:
 * - Single shared PostgreSQL client connection
 * - Channel registration system (Map<channel, handler>)
 * - Graceful error handling and reconnection
 * - Easy to swap with Redis Pub/Sub in future
 */
export class PgNotifyManager {
  private client: Client | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers: Map<string, NotificationHandler<any>> = new Map()
  private io: SocketIOServer
  private isConnected = false
  private reconnectTimeout: NodeJS.Timeout | null = null

  constructor(io: SocketIOServer) {
    this.io = io
  }

  /**
   * Register a handler for a specific PostgreSQL channel
   */
  registerChannel<T extends PgNotifyPayload>(channel: string, handler: NotificationHandler<T>): void {
    this.handlers.set(channel, handler)
    console.log(`[PgNotifyManager] Registered handler for channel: ${channel}`)
  }

  /**
   * Initialize connection and start listening
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      console.log('[PgNotifyManager] Already connected')
      return
    }

    try {
      // Create PostgreSQL client
      this.client = new Client({
        connectionString: process.env.DATABASE_URL,
      })

      // Handle connection errors
      this.client.on('error', (err) => {
        console.error('[PgNotifyManager] PostgreSQL client error:', err)
        this.handleDisconnect()
      })

      // Handle notifications
      this.client.on('notification', (msg) => {
        if (!msg.channel || !msg.payload) {
          console.warn('[PgNotifyManager] Received notification without channel or payload')
          return
        }

        const handler = this.handlers.get(msg.channel)
        if (!handler) {
          console.warn(`[PgNotifyManager] No handler registered for channel: ${msg.channel}`)
          return
        }

        try {
          const payload = JSON.parse(msg.payload)
          console.log(`[PgNotifyManager] Received on ${msg.channel}:`, payload)
          handler(payload, this.io)
        } catch (error) {
          console.error(`[PgNotifyManager] Error handling notification on ${msg.channel}:`, error)
        }
      })

      // Connect to database
      await this.client.connect()
      this.isConnected = true
      console.log('[PgNotifyManager] ✅ Connected to PostgreSQL')

      // Subscribe to all registered channels
      for (const channel of this.handlers.keys()) {
        await this.client.query(`LISTEN ${channel}`)
        console.log(`[PgNotifyManager] 👂 Listening on channel: ${channel}`)
      }
    } catch (error) {
      console.error('[PgNotifyManager] Failed to connect:', error)
      this.handleDisconnect()
      throw error
    }
  }

  /**
   * Handle disconnection and attempt reconnect
   */
  private handleDisconnect(): void {
    this.isConnected = false
    this.client = null

    // Clear any existing reconnect timeout
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
    }

    // Attempt reconnect after 5 seconds
    console.log('[PgNotifyManager] Attempting reconnect in 5 seconds...')
    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((err) => {
        console.error('[PgNotifyManager] Reconnect failed:', err)
      })
    }, 5000)
  }

  /**
   * Gracefully close connection with timeout
   */
  async disconnect(): Promise<void> {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.client) {
      try {
        // Graceful disconnect with 5-second timeout
        await Promise.race([
          this.client.end(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Disconnect timeout after 5 seconds')), 5000)
          ),
        ])
        console.log('[PgNotifyManager] ✅ Disconnected from PostgreSQL')
      } catch (error) {
        console.error('[PgNotifyManager] Error during graceful disconnect:', error)
        throw error  // Propagate error so shutdown() can handle it
      }
      this.client = null
    }

    this.isConnected = false
  }

  /**
   * Force close connection immediately without waiting for PostgreSQL
   * Use this when graceful disconnect fails or times out
   */
  forceClose(): void {
    console.log('[PgNotifyManager] Forcing connection close...')

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.client) {
      try {
        // Force end connection immediately (don't wait for PostgreSQL)
        // @ts-ignore - end() with force is not in types but exists
        this.client.end({ force: true })
        console.log('[PgNotifyManager] ✅ Forced connection close')
      } catch (error) {
        console.error('[PgNotifyManager] Error during force close:', error)
        // Ignore errors - we're forcing shutdown anyway
      }
      this.client = null
    }

    this.isConnected = false
  }
}
