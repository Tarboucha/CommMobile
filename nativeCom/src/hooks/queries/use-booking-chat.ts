import { useState, useEffect } from 'react';
import { useChatMessages } from './use-chat-messages';
import { getBookingConversation } from '@/lib/api/chat';

export function useBookingChat(bookingId: string, userId: string | null) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  // Resolve booking → conversationId
  useEffect(() => {
    let cancelled = false;

    getBookingConversation(bookingId)
      .then((conv) => { if (!cancelled) setConversationId(conv.id); })
      .catch((err) => console.error('Failed to get booking conversation:', err))
      .finally(() => { if (!cancelled) setResolving(false); });

    return () => { cancelled = true; };
  }, [bookingId]);

  const chat = useChatMessages({
    conversationId,
    userId,
    socketRoom: conversationId
      ? { joinEvent: 'join:booking', leaveEvent: 'leave:booking', roomId: bookingId }
      : undefined,
    enabled: !!conversationId,
  });

  return {
    ...chat,
    isLoading: resolving || chat.isLoading,
  };
}
