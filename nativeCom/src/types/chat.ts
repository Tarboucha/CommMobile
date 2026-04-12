// ============================================================================
// Message Types
// ============================================================================

export type MessageType =
  | 'text'
  | 'booking_request'
  | 'price_offer'
  | 'offer_response'
  | 'status_update';

// Sender profile info joined onto messages
export interface MessageSender {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

// Message with sender profile
export interface ChatMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: MessageType;
  metadata: Record<string, unknown> | null;
  reply_to_message_id: string | null;
  has_attachments: boolean;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: string;
  sender: MessageSender;
}

// Conversation with participant info for list views
export interface ConversationListItem {
  id: string;
  conversation_type: 'direct' | 'community' | 'booking';
  booking_id: string | null;
  community_id: string | null;
  title: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string | null;
  last_read_at: string | null;
  is_muted: boolean;
  participants: MessageSender[];
}
