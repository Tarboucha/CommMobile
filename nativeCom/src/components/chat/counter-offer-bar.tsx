import { useState } from 'react';
import { View, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useSubmitOffer } from '@/hooks/queries/use-booking-mutations';

interface Props {
  bookingId: string;
  currency: string;
  /** Pre-filled amount (e.g., from the offer being countered) */
  initialAmount?: number;
  onClose: () => void;
}

export function CounterOfferBar({ bookingId, currency, initialAmount, onClose }: Props) {
  const [amount, setAmount] = useState(initialAmount ? String(initialAmount) : '');
  const [note, setNote] = useState('');
  const offerMutation = useSubmitOffer(bookingId);

  const parsedAmount = parseFloat(amount);
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;

  const handleSubmit = () => {
    if (!isValid || offerMutation.isPending) return;
    offerMutation.mutate(
      { action: 'counter', offered_amount: parsedAmount, note: note.trim() || undefined },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  return (
    <View className="border-t border-border bg-card px-4 py-3 gap-2">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-foreground">Make an offer</Text>
        <Pressable onPress={onClose} className="p-1">
          <Ionicons name="close" size={18} color="#78716C" />
        </Pressable>
      </View>

      <View className="flex-row gap-2">
        <View className="flex-1 flex-row items-center border border-border rounded-xl px-3 py-2 bg-background">
          <TextInput
            className="flex-1 text-base font-bold text-foreground"
            placeholder="0.00"
            placeholderTextColor="#9CA3AF"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            autoFocus
          />
          <Text className="text-sm text-muted-foreground ml-1">{currency}</Text>
        </View>

        <View className="flex-1">
          <TextInput
            className="border border-border rounded-xl px-3 py-2 bg-background text-sm text-foreground"
            placeholder="Note (optional)"
            placeholderTextColor="#9CA3AF"
            value={note}
            onChangeText={setNote}
            maxLength={200}
          />
        </View>
      </View>

      <Pressable
        className={`flex-row items-center justify-center gap-2 py-3 rounded-xl bg-primary ${
          !isValid || offerMutation.isPending ? 'opacity-50' : ''
        }`}
        onPress={handleSubmit}
        disabled={!isValid || offerMutation.isPending}
      >
        {offerMutation.isPending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <>
            <Ionicons name="pricetag-outline" size={18} color="#FFFFFF" />
            <Text className="text-sm font-bold text-primary-foreground">
              Send Offer{isValid ? ` — ${parsedAmount.toFixed(2)} ${currency}` : ''}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}
