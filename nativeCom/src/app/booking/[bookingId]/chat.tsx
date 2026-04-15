import { useState } from 'react';
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
import { useBookingChat } from '@/hooks/queries/use-booking-chat';
import { useBookingDetail } from '@/hooks/queries/use-bookings';
import { useAuthStore } from '@/lib/stores/auth-store';
import { ChatMessageRenderer } from '@/components/chat/chat-message';
import { CounterOfferBar } from '@/components/chat/counter-offer-bar';

export default function BookingChatScreen() {
  const { bookingId, bookingNumber } = useLocalSearchParams<{
    bookingId: string;
    bookingNumber?: string;
  }>();
  const insets = useSafeAreaInsets();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [showOfferBar, setShowOfferBar] = useState(false);

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

  // Fetch booking to check if negotiation is possible
  const { data: booking } = useBookingDetail(bookingId);
  const isPending = booking?.booking_status === 'pending';
  const hasPrice = (booking?.total_amount ?? 0) > 0;

  // Hide the "Make an Offer" chip if the user already has a pending offer
  // (waiting for the other party's response — initial offer or counter-offer)
  const hasOwnPendingOffer = messages.some(
    (m) =>
      m.message_type === 'price_offer' &&
      m.sender_id === userId &&
      ((m.metadata as { offer_status?: string } | null | undefined)?.offer_status ?? 'pending') === 'pending'
  );
  // Also hide if the latest price_offer is from the current user (still awaiting response)
  const latestOffer = [...messages].reverse().find((m) => m.message_type === 'price_offer');
  const waitingForResponse = latestOffer?.sender_id === userId;

  const canNegotiate = isPending && hasPrice && !hasOwnPendingOffer && !waitingForResponse;
  const currency = booking?.currency_code ?? 'EUR';

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
              <ChatMessageRenderer
                message={item}
                isOwn={item.sender_id === userId}
                bookingId={bookingId}
                userId={userId!}
                onCounter={() => setShowOfferBar(true)}
              />
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

        {/* Counter-offer bar (replaces input when active) */}
        {showOfferBar ? (
          <CounterOfferBar
            bookingId={bookingId}
            currency={currency}
            onClose={() => setShowOfferBar(false)}
          />
        ) : (
          <View style={{ paddingBottom: Math.max(insets.bottom, 12) }}>
            {/* "Make an Offer" chip (when negotiation is possible) */}
            {canNegotiate && (
              <Pressable
                className="flex-row items-center gap-1.5 px-4 py-2 mx-4 mb-1 rounded-full bg-primary/10 self-start"
                onPress={() => setShowOfferBar(true)}
              >
                <Ionicons name="pricetag-outline" size={14} color="#660000" />
                <Text className="text-xs font-semibold text-primary">Make an Offer</Text>
              </Pressable>
            )}

            {/* Text input bar */}
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
          </View>
        )}
      </KeyboardAvoidingView>
    </>
  );
}
