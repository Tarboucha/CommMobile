import { fetchAPI } from '@/lib/api/client';
import type { ChatMessage, Conversation, ConversationListItem } from '@/types/chat';
import type { PaginatedResponse } from '@/types/community';

/**
 * Get the community's group conversation
 */
export async function getCommunityConversation(
  communityId: string
): Promise<Conversation> {
  const response = await fetchAPI<{
    success: boolean;
    data: { conversation: Conversation };
  }>(`/api/communities/${communityId}/conversation`, { method: 'GET' });

  return response.data.conversation;
}

/**
 * Get paginated message history (newest first)
 */
export async function getMessages(
  communityId: string,
  limit = 30,
  after?: string
): Promise<PaginatedResponse<ChatMessage>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (after) params.set('after', after);

  const response = await fetchAPI<{
    success: boolean;
    data: PaginatedResponse<ChatMessage>;
  }>(`/api/communities/${communityId}/conversation/messages?${params}`, {
    method: 'GET',
  });

  return response.data;
}

/**
 * Send a message to the community chat
 */
export async function sendMessage(
  communityId: string,
  content: string
): Promise<ChatMessage> {
  const response = await fetchAPI<{
    success: boolean;
    data: { message: ChatMessage };
  }>(`/api/communities/${communityId}/conversation/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

  return response.data.message;
}

// ============================================================================
// Booking Chat
// ============================================================================

/**
 * Get or create the booking's conversation
 */
export async function getBookingConversation(
  bookingId: string
): Promise<Conversation> {
  const response = await fetchAPI<{
    success: boolean;
    data: { conversation: Conversation };
  }>(`/api/bookings/${bookingId}/conversation`, { method: 'GET' });

  return response.data.conversation;
}

// ============================================================================
// Direct Messages
// ============================================================================

/**
 * Get or create a direct conversation with another user
 */
export async function getOrCreateDirectConversation(
  otherProfileId: string
): Promise<Conversation> {
  const response = await fetchAPI<{
    success: boolean;
    data: { conversation: Conversation };
  }>('/api/conversations/direct', {
    method: 'POST',
    body: JSON.stringify({ other_profile_id: otherProfileId }),
  });

  return response.data.conversation;
}

// ============================================================================
// Shared (Booking + Direct)
// ============================================================================

/**
 * Get paginated messages for any conversation (booking or direct)
 */
export async function getConversationMessages(
  conversationId: string,
  limit = 30,
  after?: string
): Promise<PaginatedResponse<ChatMessage>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (after) params.set('after', after);

  const response = await fetchAPI<{
    success: boolean;
    data: PaginatedResponse<ChatMessage>;
  }>(`/api/conversations/${conversationId}/messages?${params}`, {
    method: 'GET',
  });

  return response.data;
}

/**
 * Send a message to any conversation (booking or direct)
 */
export async function sendConversationMessage(
  conversationId: string,
  content: string
): Promise<ChatMessage> {
  const response = await fetchAPI<{
    success: boolean;
    data: { message: ChatMessage };
  }>(`/api/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  });

  return response.data.message;
}

/**
 * List user's conversations (optionally filtered by type)
 */
export async function listConversations(
  type?: 'direct' | 'booking'
): Promise<ConversationListItem[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  const query = params.toString();

  const response = await fetchAPI<{
    success: boolean;
    data: { conversations: ConversationListItem[] };
  }>(`/api/conversations${query ? `?${query}` : ''}`, { method: 'GET' });

  return response.data.conversations;
}
