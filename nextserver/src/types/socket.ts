import type { Socket } from 'socket.io';

/**
 * Socket.io types for real-time communication
 */

// ============================================================================
// Authenticated Socket
// ============================================================================

/**
 * Socket with authenticated user info attached
 * userId is the profile_id, attached after JWT verification
 */
export interface AuthenticatedSocket extends Socket {
  userId: string; // profile_id
}

// ============================================================================
// Auth Handshake
// ============================================================================

/**
 * Auth data sent by client during Socket.io connection handshake
 * Client sends: io({ auth: { token, profileId } })
 */
export interface SocketAuthPayload {
  token: string;      // Supabase JWT token
  profileId: string;  // Client's profile ID (verified against token)
}

// ============================================================================
// Server to Client Events
// ============================================================================

export interface ServerToClientEvents {
  // Notification events
  'notification:badge_update': (data: BadgeUpdatePayload) => void;
  'notification:new': (data: NewNotificationPayload) => void;

  // Chat events
  'message:new': (data: NewMessagePayload) => void;

  // Connection events
  'error': (data: { message: string }) => void;
}

// ============================================================================
// Client to Server Events
// ============================================================================

export interface ClientToServerEvents {
  // Room management
  'join:user': (profileId: string) => void;
  'leave:user': (profileId: string) => void;

  // Community rooms (for community chat)
  'join:community': (communityId: string) => void;
  'leave:community': (communityId: string) => void;

  // Booking rooms (for booking chat)
  'join:booking': (bookingId: string) => void;
  'leave:booking': (bookingId: string) => void;

  // Conversation rooms (for direct messages)
  'join:conversation': (conversationId: string) => void;
  'leave:conversation': (conversationId: string) => void;
}

// ============================================================================
// Event Payloads
// ============================================================================

/**
 * Badge count update payload
 */
export interface BadgeUpdatePayload {
  badge_count: number;
}

/**
 * New notification payload
 */
export interface NewNotificationPayload {
  id: string;
  type: string;
  title: string;
  body?: string;
  data?: Record<string, unknown>;
  created_at: string;
}

/**
 * New chat message payload (broadcast to room)
 */
export interface NewMessagePayload {
  message_id: string;
  conversation_id: string;
  conversation_type: 'community' | 'direct' | 'booking';
  community_id: string | null;
  booking_id: string | null;
  sender_id: string;
  content: string | null;
  created_at: string;
}
