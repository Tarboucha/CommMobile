import { useChatMessages } from './use-chat-messages';

export function useDirectChat(conversationId: string, userId: string | null) {
  return useChatMessages({
    conversationId,
    userId,
    socketRoom: {
      joinEvent: 'join:conversation',
      leaveEvent: 'leave:conversation',
      roomId: conversationId,
    },
  });
}
