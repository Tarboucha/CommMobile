import type { Database } from '@/types/supabase';

// Base types from Supabase schema
export type Conversation = Database['public']['Tables']['conversations']['Row'];
export type Message = Database['public']['Tables']['messages']['Row'];
export type ConversationParticipant = Database['public']['Tables']['conversation_participants']['Row'];

// Sender profile info joined onto messages
export interface MessageSender {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

// Message with sender profile (from Supabase join query)
export interface ChatMessage extends Message {
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
