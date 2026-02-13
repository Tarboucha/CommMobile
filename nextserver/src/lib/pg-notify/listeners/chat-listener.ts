// src/lib/pg-notify/listeners/chat-listener.ts
// Handler for message_created events from PostgreSQL

import type { NotificationHandler, PgNotifyPayload } from '../pg-notify-manager'

interface MessageCreatedPayload extends PgNotifyPayload {
  message_id: string
  conversation_id: string
  conversation_type: 'community' | 'direct' | 'booking'
  community_id: string | null
  booking_id: string | null
  sender_id: string
  content: string | null
  created_at: string
}

/**
 * Handles message_created events from PostgreSQL NOTIFY
 *
 * Flow:
 * 1. Message inserted into `messages` table
 * 2. AFTER INSERT trigger calls pg_notify('message_created', payload)
 * 3. PgNotifyManager routes to this handler
 * 4. Handler broadcasts to the appropriate Socket.io room
 *
 * Room mapping:
 *   community → community:{community_id}
 *   direct    → conversation:{conversation_id}
 *   booking   → booking:{booking_id}
 */
export const chatListener: NotificationHandler<MessageCreatedPayload> = async (payload, io) => {
  try {
    const message = payload

    if (!message.conversation_id) {
      console.warn('[ChatListener] Received message without conversation_id')
      return
    }

    // Determine the target room based on conversation type
    let room: string
    switch (message.conversation_type) {
      case 'community':
        room = `community:${message.community_id}`
        break
      case 'booking':
        room = `booking:${message.booking_id}`
        break
      case 'direct':
      default:
        room = `conversation:${message.conversation_id}`
        break
    }

    // Broadcast to all clients in the room
    io.to(room).emit('message:new', {
      message_id: message.message_id,
      conversation_id: message.conversation_id,
      conversation_type: message.conversation_type,
      community_id: message.community_id,
      booking_id: message.booking_id,
      sender_id: message.sender_id,
      content: message.content,
      created_at: message.created_at,
    })

    console.log(
      `[ChatListener] Broadcasted message ${message.message_id} to room ${room}`
    )
  } catch (error) {
    console.error('[ChatListener] Error processing message:', error)
  }
}
