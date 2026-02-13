// src/lib/realtime/listeners/index.ts
// Central registry for all PostgreSQL NOTIFY listeners

import type { PgNotifyManager } from '../pg-notify-manager'
import { notificationListener } from './notification-listener'
import { chatListener } from './chat-listener'

/**
 * Register all listeners with the PgNotifyManager
 *
 * Adding new features:
 * 1. Create a new listener file (e.g., my-listener.ts)
 * 2. Import the listener here
 * 3. Register with manager.registerChannel()
 */
export function registerListeners(manager: PgNotifyManager): void {
  // Notification events
  manager.registerChannel('notification_created', notificationListener)

  // Chat message events
  manager.registerChannel('message_created', chatListener)

  console.log('[Listeners] All listeners registered')
}
