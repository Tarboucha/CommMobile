import type { Socket } from 'socket.io'

export interface AuthenticatedSocket extends Socket {
  userId: string // profile_id (verified from DB, not client claim)
}

export interface SocketAuthPayload {
  token: string     // Supabase JWT
  profileId: string // Client's profile ID (verified against token)
}

export interface ServerToClientEvents {
  'notification:badge_update': (data: { badge_count: number }) => void
  'notification:new': (data: NewNotificationPayload) => void
  'message:new': (data: NewMessagePayload) => void
  'connected': (data: { socketId: string; userId: string; timestamp: number }) => void
  'error': (data: { message: string }) => void
}

export interface ClientToServerEvents {
  'join:community': (communityId: string) => void
  'leave:community': (communityId: string) => void
  'join:booking': (bookingId: string) => void
  'leave:booking': (bookingId: string) => void
  'join:conversation': (conversationId: string) => void
  'leave:conversation': (conversationId: string) => void
}

export interface NewNotificationPayload {
  id: string
  type: string
  title: string
  body?: string
  data?: Record<string, unknown>
  created_at: string
}

export interface NewMessagePayload {
  message_id: string
  conversation_id: string
  conversation_type: 'community' | 'direct' | 'booking'
  community_id: string | null
  booking_id: string | null
  sender_id: string
  content: string | null
  created_at: string
}
