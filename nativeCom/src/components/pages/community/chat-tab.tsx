import {
  View,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useCommunityChat } from '@/hooks/use-community-chat';
import { MessageBubble } from './message-bubble';

interface ChatTabProps {
  communityId: string;
  isMember: boolean;
  userId: string | null;
}

export function ChatTab({ communityId, isMember, userId }: ChatTabProps) {
  const {
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
  } = useCommunityChat(communityId, isMember, userId);

  // Non-member view
  if (!isMember) {
    return (
      <View className="flex-1 bg-background justify-center items-center p-6">
        <Ionicons name="chatbubbles-outline" size={48} color="#78716C" />
        <Text className="text-lg font-semibold text-foreground mt-4 mb-2">
          Community Chat
        </Text>
        <Text className="text-sm text-muted-foreground text-center">
          Join this community to participate in the chat.
        </Text>
      </View>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  // Error state
  if (error) {
    return (
      <View className="flex-1 bg-background justify-center items-center p-6">
        <Ionicons name="alert-circle-outline" size={48} color="#78716C" />
        <Text className="text-sm text-muted-foreground text-center mt-4">
          {error}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      {/* Message list (inverted — newest at bottom) */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        inverted
        renderItem={({ item }) => (
          <MessageBubble message={item} isOwn={item.sender_id === userId} />
        )}
        contentContainerStyle={{ paddingVertical: 12 }}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator size="small" style={{ padding: 16 }} />
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-6">
            <Text className="text-sm text-muted-foreground">
              No messages yet. Start the conversation!
            </Text>
          </View>
        }
      />

      {/* Input bar */}
      <View className="flex-row items-end px-4 py-3 border-t border-border bg-card">
        <TextInput
          className="flex-1 bg-background rounded-2xl px-4 py-2 text-sm text-foreground mr-2 max-h-24"
          placeholder="Message..."
          placeholderTextColor="#78716C"
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!isSending}
          onSubmitEditing={handleSend}
          submitBehavior="newline"
        />
        <Pressable
          className={`w-10 h-10 rounded-full justify-center items-center ${
            inputText.trim() && !isSending ? 'bg-primary' : 'bg-muted'
          }`}
          onPress={handleSend}
          disabled={!inputText.trim() || isSending}
        >
          <Ionicons
            name="send"
            size={18}
            color={inputText.trim() && !isSending ? '#FFFFFF' : '#78716C'}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
