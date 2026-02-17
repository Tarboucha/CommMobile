import {
  View,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useDirectChat } from '@/hooks/use-direct-chat';
import { useAuthStore } from '@/lib/stores/auth-store';
import { MessageBubble } from '@/components/pages/community/message-bubble';

export default function DirectChatScreen() {
  const { conversationId, name } = useLocalSearchParams<{
    conversationId: string;
    name?: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);

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
  } = useDirectChat(conversationId!, userId);

  if (!conversationId) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <Text className="text-sm text-muted-foreground">Invalid conversation.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-background"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Header */}
      <View
        className="flex-row items-center px-4 pb-3 border-b border-border bg-card"
        style={{ paddingTop: insets.top + 8 }}
      >
        <Pressable
          className="w-10 h-10 rounded-full justify-center items-center mr-2"
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={22} color="#78716C" />
        </Pressable>
        <View className="w-9 h-9 rounded-full bg-primary/10 justify-center items-center mr-3">
          <Ionicons name="person" size={16} color="#660000" />
        </View>
        <Text className="text-base font-semibold text-foreground flex-1" numberOfLines={1}>
          {name || 'Conversation'}
        </Text>
      </View>

      {/* Loading */}
      {isLoading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" />
        </View>
      ) : error ? (
        <View className="flex-1 justify-center items-center p-6">
          <Ionicons name="alert-circle-outline" size={48} color="#78716C" />
          <Text className="text-sm text-muted-foreground text-center mt-4">
            {error}
          </Text>
        </View>
      ) : (
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
                No messages yet. Say hello!
              </Text>
            </View>
          }
        />
      )}

      {/* Input bar */}
      <View
        className="flex-row items-end px-4 py-3 border-t border-border bg-card"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
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
