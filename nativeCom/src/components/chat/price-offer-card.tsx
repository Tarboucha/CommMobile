import { View, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useSubmitOffer } from '@/hooks/queries/use-booking-mutations';
import { getSenderName, formatMessageTime } from '@/lib/utils/chat';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  bookingId: string;
  userId: string;
  onCounter?: () => void;
}

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

export function PriceOfferCard({ message, isOwn, bookingId, userId, onCounter }: Props) {
  const meta = message.metadata as {
    offer_id?: string;
    offered_amount?: number;
    currency?: string;
    note?: string | null;
  } | null;

  const offerId = meta?.offer_id;
  const amount = meta?.offered_amount ?? 0;
  const currency = meta?.currency ?? 'EUR';
  const note = meta?.note;

  // Check if this offer is actionable (pending + viewer is the recipient)
  const isRecipient = !isOwn;
  const offerMutation = useSubmitOffer(bookingId);
  const isPending = offerMutation.isPending;

  return (
    <View className={`px-4 mb-3 ${isOwn ? 'items-end' : 'items-start'}`}>
      {!isOwn && (
        <Text className="text-xs text-muted-foreground mb-1 ml-1">
          {getSenderName(message.sender)}
        </Text>
      )}

      <View
        className={`rounded-2xl overflow-hidden max-w-[85%] border-2 ${
          isOwn ? 'border-primary/30 bg-primary/5' : 'border-amber-300/50 bg-amber-50'
        }`}
      >
        {/* Offer header */}
        <View className={`flex-row items-center gap-2 px-4 py-2 ${isOwn ? 'bg-primary/10' : 'bg-amber-100'}`}>
          <Ionicons name="pricetag-outline" size={16} color={isOwn ? '#660000' : '#D97706'} />
          <Text className={`text-xs font-bold uppercase tracking-wide ${isOwn ? 'text-primary' : 'text-amber-700'}`}>
            {isOwn ? 'Your Offer' : 'Offer'}
          </Text>
        </View>

        {/* Amount */}
        <View className="px-4 py-3">
          <Text className="text-xl font-bold text-foreground">
            {formatCurrency(amount, currency)}
          </Text>
          {note && (
            <Text className="text-sm text-muted-foreground mt-1">
              "{note}"
            </Text>
          )}
        </View>

        {/* Action buttons (only for recipient, only when offer_id exists) */}
        {isRecipient && offerId && (
          <View className="flex-row border-t border-border">
            <Pressable
              className="flex-1 py-3 items-center justify-center border-r border-border"
              onPress={() => offerMutation.mutate({ action: 'accept', offer_id: offerId })}
              disabled={isPending}
            >
              {isPending ? (
                <ActivityIndicator size="small" color="#059669" />
              ) : (
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="checkmark-circle" size={18} color="#059669" />
                  <Text className="text-sm font-semibold text-emerald-600">Accept</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              className="flex-1 py-3 items-center justify-center border-r border-border"
              onPress={() => onCounter?.()}
              disabled={isPending}
            >
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="swap-horizontal" size={18} color="#3B82F6" />
                <Text className="text-sm font-semibold text-blue-500">Counter</Text>
              </View>
            </Pressable>

            <Pressable
              className="flex-1 py-3 items-center justify-center"
              onPress={() => offerMutation.mutate({ action: 'decline', offer_id: offerId })}
              disabled={isPending}
            >
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="close-circle" size={18} color="#EF4444" />
                <Text className="text-sm font-semibold text-red-500">Decline</Text>
              </View>
            </Pressable>
          </View>
        )}
      </View>

      <Text className="text-[10px] text-muted-foreground mt-0.5 mx-1">
        {formatMessageTime(message.created_at)}
      </Text>
    </View>
  );
}
