// src/lib/pg-notify/listeners/notification-listener.ts
// Handler for notification_created events from PostgreSQL

import type { NotificationHandler } from '../pg-notify-manager'
import type { NotificationTriggerPayload } from '@/types/notification'
import { sendPushToUser, NOTIFICATION_MESSAGES } from '../../services/expo-push-service'

/**
 * Handles notification_created events from PostgreSQL NOTIFY
 *
 * Flow:
 * 1. Notification inserted into `notifications` table
 * 2. AFTER INSERT trigger calls pg_notify('notification_created', payload)
 * 3. PgNotifyManager routes to this handler
 * 4. If user online: emit badge_update + notification:new via Socket.io
 * 5. If user offline: send Push Notification
 */
export const notificationListener: NotificationHandler<NotificationTriggerPayload> = async (payload, io) => {
  try {
    const profileId = payload.profile_id
    const badgeCount = payload.badge_count || 0

    console.log(`[NotificationListener] Processing notification for profile ${profileId}`)
    console.log(`[NotificationListener] Badge count: ${badgeCount}, Type: ${payload.notification_type}`)

    // Check if user is connected via Socket.io
    const userRoom = io.sockets.adapter.rooms.get(`user:${profileId}`)
    const isConnected = userRoom && userRoom.size > 0

    if (isConnected) {
      // User is online — send both events via Socket.io
      io.to(`user:${profileId}`).emit('notification:badge_update', {
        badge_count: badgeCount,
      })

      io.to(`user:${profileId}`).emit('notification:new', {
        id: payload.notification_id,
        type: payload.notification_type,
        title: payload.title,
        body: payload.body,
        data: payload.data_json,
        created_at: payload.created_at,
      })

      console.log(`[NotificationListener] Sent Socket.io events to user:${profileId}`)
    } else {
      // User is offline — send Push Notification
      console.log(`[NotificationListener] User ${profileId} is offline - sending Push Notification`)

      const message = NOTIFICATION_MESSAGES[payload.notification_type] || NOTIFICATION_MESSAGES.system
      await sendPushToUser(
        profileId,
        message.title,
        message.body,
        { type: payload.notification_type },
        badgeCount
      )
      console.log(`[NotificationListener] Sent Push Notification to user:${profileId} (type: ${payload.notification_type}, badge: ${badgeCount})`)
    }
  } catch (error) {
    console.error('[NotificationListener] Error processing notification:', error)
  }
}
