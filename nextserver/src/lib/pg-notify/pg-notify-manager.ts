// src/lib/pg-notify/pg-notify-manager.ts
// Core PostgreSQL NOTIFY/LISTEN manager
// Manages a single PG connection and routes notifications to registered handlers
// Note: This is NOT Supabase Realtime - it's our custom PostgreSQL NOTIFY/LISTEN implementation

import { Client } from 'pg'
import type { Server as SocketIOServer } from 'socket.io'
import { log } from '@/lib/log'

const mgrLog = log.child({ component: 'pg-notify-manager' })

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
    mgrLog.info({ channel }, 'registered channel handler')
  }

  /**
   * Initialize connection and start listening
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      mgrLog.debug('already connected')
      return
    }

    try {
      // Create PostgreSQL client
      this.client = new Client({
        connectionString: process.env.DATABASE_URL,
      })

      // Handle connection errors
      this.client.on('error', (err) => {
        mgrLog.error({ err }, 'pg client error')
        this.handleDisconnect()
      })

      // Handle notifications
      this.client.on('notification', (msg) => {
        if (!msg.channel || !msg.payload) {
          mgrLog.warn({ msg }, 'notification missing channel or payload')
          return
        }

        const handler = this.handlers.get(msg.channel)
        if (!handler) {
          mgrLog.warn({ channel: msg.channel }, 'no handler for channel')
          return
        }

        try {
          const payload = JSON.parse(msg.payload)
          mgrLog.debug({ channel: msg.channel, payload }, 'received notification')
          handler(payload, this.io)
        } catch (err) {
          mgrLog.error({ err, channel: msg.channel }, 'error handling notification')
        }
      })

      // Connect to database
      await this.client.connect()
      this.isConnected = true
      mgrLog.info('connected to PostgreSQL')

      // Subscribe to all registered channels
      for (const channel of this.handlers.keys()) {
        await this.client.query(`LISTEN ${channel}`)
        mgrLog.info({ channel }, 'listening on channel')
      }
    } catch (err) {
      mgrLog.error({ err }, 'failed to connect')
      this.handleDisconnect()
      throw err
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
    mgrLog.warn('attempting reconnect in 5s')
    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch((err) => {
        mgrLog.error({ err }, 'reconnect failed')
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
        mgrLog.info('disconnected from PostgreSQL')
      } catch (err) {
        mgrLog.error({ err }, 'error during graceful disconnect')
        throw err  // Propagate error so shutdown() can handle it
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
    mgrLog.warn('forcing connection close')

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }

    if (this.client) {
      try {
        // Force end connection immediately (don't wait for PostgreSQL)
        // @ts-ignore - end() with force is not in types but exists
        this.client.end({ force: true })
        mgrLog.info('forced connection close')
      } catch (err) {
        mgrLog.error({ err }, 'error during force close')
        // Ignore errors - we're forcing shutdown anyway
      }
      this.client = null
    }

    this.isConnected = false
  }
}
