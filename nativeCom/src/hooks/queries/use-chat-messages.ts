import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { FlatList } from 'react-native';
import { useInfiniteQuery, useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useSocket } from '@/contexts/socket-context';
import { queryKeys } from '@/lib/query-keys';
import { getConversationMessages, sendConversationMessage } from '@/lib/api/chat';
import type { ChatMessage } from '@/types/chat';
import type { PaginatedResponse } from '@/types/community';

interface SocketMessagePayload {
  message_id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  created_at: string;
}

function socketPayloadToMessage(data: SocketMessagePayload): ChatMessage {
  return {
    id: data.message_id,
    conversation_id: data.conversation_id,
    sender_id: data.sender_id,
    content: data.content,
    message_type: 'text',
    metadata: null,
    is_edited: false,
    is_deleted: false,
    created_at: data.created_at,
    has_attachments: false,
    reply_to_message_id: null,
    sender: {
      id: data.sender_id,
      display_name: null,
      first_name: null,
      last_name: null,
      avatar_url: null,
    },
  };
}

interface UseChatMessagesOptions {
  conversationId: string | null;
  userId: string | null;
  /** Socket room to join/leave (e.g., { event: 'join:community', id: communityId }) */
  socketRoom?: { joinEvent: string; leaveEvent: string; roomId: string };
  /** Custom message fetcher — defaults to getConversationMessages */
  fetchMessages?: (limit: number, cursor?: string) => Promise<PaginatedResponse<ChatMessage>>;
  /** Custom send function — defaults to sendConversationMessage */
  sendMessage?: (text: string) => Promise<ChatMessage>;
  enabled?: boolean;
}

export function useChatMessages({
  conversationId,
  userId,
  socketRoom,
  fetchMessages,
  sendMessage,
  enabled = true,
}: UseChatMessagesOptions) {
  const { socket } = useSocket();
  const queryClient = useQueryClient();
  const [inputText, setInputText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const queryKey = useMemo(
    () => queryKeys.conversations.messages(conversationId ?? '__none__'),
    [conversationId]
  );

  // Fetch function: use custom or default
  const fetcher = useCallback(
    (limit: number, cursor?: string) => {
      if (fetchMessages) return fetchMessages(limit, cursor);
      return getConversationMessages(conversationId!, limit, cursor);
    },
    [conversationId, fetchMessages]
  );

  // Message pagination with useInfiniteQuery
  const messagesQuery = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) => fetcher(30, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.next_cursor ?? undefined,
    enabled: enabled && !!conversationId,
  });

  // Flatten pages into a single messages array.
  // The list is rendered with `inverted` FlatList — array[0] = bottom = newest.
  // Sort DESC by created_at, but for ties (system messages emitted in the same
  // DB transaction) push booking_request to the back so it always renders ABOVE
  // the price_offer/status_update messages it spawns.
  const messages = useMemo(() => {
    const flat = messagesQuery.data?.pages.flatMap((page) => page.data) ?? [];
    return [...flat].sort((a, b) => {
      const tsDiff = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (tsDiff !== 0) return tsDiff;
      // Same timestamp → booking_request should be the OLDEST (last in array).
      if (a.message_type === 'booking_request' && b.message_type !== 'booking_request') return 1;
      if (b.message_type === 'booking_request' && a.message_type !== 'booking_request') return -1;
      return a.id < b.id ? 1 : -1;
    });
  }, [messagesQuery.data]);

  // Socket: join/leave room + listen for new messages
  useEffect(() => {
    if (!socket || !conversationId) return;

    // Join room
    if (socketRoom) {
      socket.emit(socketRoom.joinEvent, socketRoom.roomId);
    }

    const handleNewMessage = (data: SocketMessagePayload) => {
      if (data.conversation_id !== conversationId) return;

      // Prepend message to cache directly (no refetch)
      queryClient.setQueryData<InfiniteData<PaginatedResponse<ChatMessage>>>(
        queryKey,
        (old) => {
          if (!old) return old;
          const firstPage = old.pages[0];
          // Deduplicate
          if (firstPage.data.some((m) => m.id === data.message_id)) return old;
          return {
            ...old,
            pages: [
              { ...firstPage, data: [socketPayloadToMessage(data), ...firstPage.data] },
              ...old.pages.slice(1),
            ],
          };
        }
      );

      // Also refresh conversations list (preview/ordering)
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
      if (socketRoom) {
        socket.emit(socketRoom.leaveEvent, socketRoom.roomId);
      }
    };
  }, [socket, conversationId, socketRoom, queryKey, queryClient]);

  // Send mutation
  const sender = useCallback(
    (text: string) => {
      if (sendMessage) return sendMessage(text);
      return sendConversationMessage(conversationId!, text);
    },
    [conversationId, sendMessage]
  );

  const sendMutation = useMutation({
    mutationFn: (text: string) => sender(text),
    onSuccess: (sent) => {
      // Prepend sent message to cache (deduplicated)
      queryClient.setQueryData<InfiniteData<PaginatedResponse<ChatMessage>>>(
        queryKey,
        (old) => {
          if (!old) return old;
          const firstPage = old.pages[0];
          if (firstPage.data.some((m) => m.id === sent.id)) return old;
          return {
            ...old,
            pages: [
              { ...firstPage, data: [sent, ...firstPage.data] },
              ...old.pages.slice(1),
            ],
          };
        }
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
    },
  });

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || sendMutation.isPending || !userId) return;
    setInputText('');
    sendMutation.mutate(text, {
      onError: () => {
        // Restore input text on failure
        setInputText(text);
      },
    });
  }, [inputText, sendMutation, userId]);

  return {
    messages,
    isLoading: messagesQuery.isLoading,
    isLoadingMore: messagesQuery.isFetchingNextPage,
    isSending: sendMutation.isPending,
    error: messagesQuery.error ? 'Failed to load chat' : null,
    inputText,
    setInputText,
    flatListRef,
    loadMore: () => {
      if (messagesQuery.hasNextPage && !messagesQuery.isFetchingNextPage) {
        messagesQuery.fetchNextPage();
      }
    },
    handleSend,
  };
}
