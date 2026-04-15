import type { PgNotifyManager } from '../pg-notify-manager'
import { notificationListener } from './notification-listener'
import { chatListener } from './chat-listener'

export function registerListeners(manager: PgNotifyManager): void {
  manager.registerChannel('notification_created', notificationListener)
  manager.registerChannel('message_created', chatListener)
  console.log('[Listeners] All listeners registered')
}
