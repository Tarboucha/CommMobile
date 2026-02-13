import { useState, useEffect, useRef, useCallback } from 'react';
import { FlatList } from 'react-native';
import { useSocket } from '@/contexts/socket-context';
import {
  getBookingConversation,
  getConversationMessages,
  sendConversationMessage,
} from '@/lib/api/chat';
import type { ChatMessage } from '@/types/chat';

export function useBookingChat(bookingId: string, userId: string | null) {
  const { socket } = useSocket();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Load conversation and initial messages
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setIsLoading(true);
        setError(null);

        const conversation = await getBookingConversation(bookingId);
        if (cancelled) return;
        setConversationId(conversation.id);

        const result = await getConversationMessages(conversation.id, 30);
        if (cancelled) return;
        setMessages(result.data);
        setNextCursor(result.pagination.next_cursor);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load booking chat:', err);
          setError('Failed to load chat');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [bookingId]);

  // Join/leave Socket.io room + listen for new messages
  useEffect(() => {
    if (!socket || !conversationId) return;

    socket.emit('join:booking', bookingId);

    const handleNewMessage = (data: {
      message_id: string;
      conversation_id: string;
      sender_id: string;
      content: string | null;
      created_at: string;
    }) => {
      if (data.conversation_id !== conversationId) return;

      const newMessage: ChatMessage = {
        id: data.message_id,
        conversation_id: data.conversation_id,
        sender_id: data.sender_id,
        content: data.content,
        is_edited: false,
        is_deleted: false,
        created_at: data.created_at,
        has_attachments: false,
        edited_at: null,
        deleted_at: null,
        expires_at: null,
        reply_to_message_id: null,
        sender: {
          id: data.sender_id,
          display_name: null,
          first_name: null,
          last_name: null,
          avatar_url: null,
        },
      };

      setMessages((prev) => {
        if (prev.some((m) => m.id === data.message_id)) return prev;
        return [newMessage, ...prev];
      });
    };

    socket.on('message:new', handleNewMessage);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.emit('leave:booking', bookingId);
    };
  }, [socket, conversationId, bookingId]);

  // Load older messages
  const loadMore = useCallback(async () => {
    if (!nextCursor || !conversationId || isLoadingMore) return;
    try {
      setIsLoadingMore(true);
      const result = await getConversationMessages(conversationId, 30, nextCursor);
      setMessages((prev) => [...prev, ...result.data]);
      setNextCursor(result.pagination.next_cursor);
    } catch (err) {
      console.error('Failed to load more messages:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [conversationId, nextCursor, isLoadingMore]);

  // Send a message
  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || isSending || !userId || !conversationId) return;

    setInputText('');
    setIsSending(true);

    try {
      const sent = await sendConversationMessage(conversationId, text);
      setMessages((prev) => {
        if (prev.some((m) => m.id === sent.id)) return prev;
        return [sent, ...prev];
      });
    } catch (err) {
      console.error('Failed to send message:', err);
      setInputText(text);
    } finally {
      setIsSending(false);
    }
  }, [inputText, isSending, userId, conversationId]);

  return {
    messages,
    isLoading,
    isLoadingMore,
    isSending,
    error,
    inputText,
    setInputText,
    flatListRef,
    loadMore,
    handleSend,
  };
}
