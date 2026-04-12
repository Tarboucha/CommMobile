import { useState, useEffect } from 'react';
import { useChatMessages } from './use-chat-messages';
import { getCommunityConversation, getMessages, sendMessage } from '@/lib/api/chat';

export function useCommunityChat(communityId: string, isMember: boolean, userId: string | null) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [resolving, setResolving] = useState(true);

  // Resolve community → conversationId
  useEffect(() => {
    if (!isMember) return;
    let cancelled = false;

    getCommunityConversation(communityId)
      .then((conv) => { if (!cancelled) setConversationId(conv.id); })
      .catch((err) => console.error('Failed to get community conversation:', err))
      .finally(() => { if (!cancelled) setResolving(false); });

    return () => { cancelled = true; };
  }, [communityId, isMember]);

  const chat = useChatMessages({
    conversationId,
    userId,
    socketRoom: conversationId
      ? { joinEvent: 'join:community', leaveEvent: 'leave:community', roomId: communityId }
      : undefined,
    fetchMessages: (limit, cursor) => getMessages(communityId, limit, cursor),
    sendMessage: (text) => sendMessage(communityId, text),
    enabled: isMember && !!conversationId,
  });

  return {
    ...chat,
    isLoading: resolving || chat.isLoading,
  };
}
