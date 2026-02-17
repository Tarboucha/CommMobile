import { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { listConversations } from '@/lib/api/chat';
import type { ConversationListItem } from '@/types/chat';

function getOtherParticipantName(conversation: ConversationListItem): string {
  const p = conversation.participants?.[0];
  if (!p) return 'Unknown';
  if (p.first_name || p.last_name) {
    return [p.first_name, p.last_name].filter(Boolean).join(' ');
  }
  if (p.display_name) return p.display_name;
  return p.id.slice(0, 8) + '...';
}

function getOtherParticipantAvatar(conversation: ConversationListItem): string | null {
  return conversation.participants?.[0]?.avatar_url ?? null;
}

function formatTimeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function hasUnread(conversation: ConversationListItem): boolean {
  if (!conversation.last_message_at) return false;
  if (!conversation.last_read_at) return true;
  return new Date(conversation.last_message_at) > new Date(conversation.last_read_at);
}

function ConversationItem({
  conversation,
  onPress,
}: {
  conversation: ConversationListItem;
  onPress: () => void;
}) {
  const name = getOtherParticipantName(conversation);
  const avatarUrl = getOtherParticipantAvatar(conversation);
  const unread = hasUnread(conversation);

  return (
    <Pressable
      className="mx-4 mb-2 flex-row items-center p-3 rounded-xl border border-border bg-card active:opacity-70"
      onPress={onPress}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          className="w-12 h-12 rounded-full mr-3"
        />
      ) : (
        <View className="w-12 h-12 rounded-full bg-primary/10 justify-center items-center mr-3">
          <Ionicons name="person" size={20} color="#660000" />
        </View>
      )}
      <View className="flex-1 mr-2">
        <Text
          className={`text-sm text-foreground ${unread ? 'font-bold' : 'font-medium'}`}
          numberOfLines={1}
        >
          {name}
        </Text>
        {conversation.last_message_preview ? (
          <Text
            className={`text-xs mt-0.5 ${unread ? 'text-foreground font-medium' : 'text-muted-foreground'}`}
            numberOfLines={1}
          >
            {conversation.last_message_preview}
          </Text>
        ) : (
          <Text className="text-xs text-muted-foreground mt-0.5">
            No messages yet
          </Text>
        )}
      </View>
      <View className="items-end">
        <Text className="text-[10px] text-muted-foreground">
          {formatTimeAgo(conversation.last_message_at)}
        </Text>
        {unread && (
          <View className="w-2.5 h-2.5 rounded-full bg-primary mt-1" />
        )}
      </View>
    </Pressable>
  );
}

export default function ConversationsScreen() {
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      const result = await listConversations();
      setConversations(result);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadConversations();
    }, [loadConversations])
  );

  const handlePress = (conversation: ConversationListItem) => {
    const name = getOtherParticipantName(conversation);
    router.push({
      pathname: '/conversations/[conversationId]',
      params: { conversationId: conversation.id, name },
    });
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-background"
      data={conversations}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <ConversationItem
          conversation={item}
          onPress={() => handlePress(item)}
        />
      )}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => {
            setIsRefreshing(true);
            loadConversations();
          }}
        />
      }
      ListEmptyComponent={
        <View className="flex-1 justify-center items-center p-6 gap-4">
          <View className="w-16 h-16 rounded-full bg-muted justify-center items-center">
            <Ionicons name="chatbubbles-outline" size={32} color="#78716C" />
          </View>
          <Text className="text-lg font-semibold text-foreground">
            No conversations yet
          </Text>
          <Text className="text-sm text-muted-foreground text-center max-w-[280px]">
            Start a conversation by messaging a community member.
          </Text>
        </View>
      }
    />
  );
}
