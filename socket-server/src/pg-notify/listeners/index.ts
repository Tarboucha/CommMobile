import type { PgNotifyManager } from '../pg-notify-manager'
import { notificationListener } from './notification-listener'
import { chatListener } from './chat-listener'
import { log } from '../../log'

export function registerListeners(manager: PgNotifyManager): void {
  manager.registerChannel('notification_created', notificationListener)
  manager.registerChannel('message_created', chatListener)
  log.info('all pg-notify listeners registered')
}
