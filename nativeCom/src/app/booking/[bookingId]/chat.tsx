import {
  View,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui/text';
import { useBookingChat } from '@/hooks/use-booking-chat';
import { useAuthStore } from '@/lib/stores/auth-store';
import { MessageBubble } from '@/components/pages/community/message-bubble';

export default function BookingChatScreen() {
  const { bookingId, bookingNumber } = useLocalSearchParams<{
    bookingId: string;
    bookingNumber?: string;
  }>();
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
  } = useBookingChat(bookingId!, userId);

  if (!bookingId) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <Text className="text-sm text-muted-foreground">Invalid booking.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: bookingNumber ? `Chat — #${bookingNumber}` : 'Booking Chat',
        }}
      />

      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
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
    </>
  );
}
