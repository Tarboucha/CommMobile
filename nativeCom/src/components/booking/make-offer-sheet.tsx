import { useState } from 'react';
import {
  Modal,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useCreateBooking } from '@/hooks/queries/use-booking-mutations';
import { buildDirectBookingPayload } from '@/lib/direct-booking';
import { generateUUID } from '@/lib/utils/uuid';
import { handleError } from '@/lib/services/error-service';
import type { Offering, AvailabilitySchedule } from '@/types/offering';

interface MakeOfferSheetProps {
  visible: boolean;
  offering: Offering;
  /** Pre-selected schedule + date (from the parent booking sheet) */
  scheduleId?: string;
  instanceDate?: string;
  instanceStartTime?: string;
  instanceEndTime?: string;
  onClose: () => void;
}

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

export function MakeOfferSheet({
  visible,
  offering,
  scheduleId,
  instanceDate,
  instanceStartTime,
  instanceEndTime,
  onClose,
}: MakeOfferSheetProps) {
  const router = useRouter();
  const createBooking = useCreateBooking();

  const listedPrice = offering.price_amount ?? 0;
  const currency = offering.currency_code;

  const [offerAmount, setOfferAmount] = useState(listedPrice > 0 ? String(listedPrice) : '');
  const [note, setNote] = useState('');

  const parsedAmount = parseFloat(offerAmount);
  const isValid = !isNaN(parsedAmount) && parsedAmount > 0;
  const isLow = isValid && listedPrice > 0 && parsedAmount < listedPrice * 0.5;

  const handleSubmit = () => {
    if (!isValid || createBooking.isPending) return;

    const payload = buildDirectBookingPayload({
      offering,
      scheduleId: scheduleId ?? null,
      instanceDate: instanceDate ?? null,
      instanceStartTime: instanceStartTime ?? null,
      instanceEndTime: instanceEndTime ?? null,
      quantity: 1,
      paymentMethod: 'cash',
    });

    // Add offer fields
    payload.offer_amount = parsedAmount;
    if (note.trim()) payload.offer_note = note.trim();

    createBooking.mutate(payload, {
      onSuccess: (booking) => {
        onClose();
        if (booking.conversation_id) {
          router.push({
            pathname: '/booking/[bookingId]/chat',
            params: {
              bookingId: booking.id,
              bookingNumber: booking.booking_number,
            },
          });
        } else {
          router.push({
            pathname: '/booking/[bookingId]',
            params: { bookingId: booking.id },
          });
        }
      },
      onError: (err) => {
        handleError(err, {
          severity: 'alert',
          screen: 'make-offer',
          userMessage: 'Failed to submit offer.',
        });
      },
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 py-4 border-b border-border">
          <Text className="text-lg font-bold text-foreground">Make an Offer</Text>
          <Pressable onPress={onClose} className="w-8 h-8 rounded-full bg-muted items-center justify-center">
            <Ionicons name="close" size={18} color="#78716C" />
          </Pressable>
        </View>

        <View className="flex-1 p-5 gap-5">
          {/* Listed price reference */}
          <View className="p-4 rounded-xl bg-muted/50 flex-row justify-between items-center">
            <Text className="text-sm text-muted-foreground">Listed price</Text>
            <Text className="text-base font-semibold text-foreground">
              {listedPrice > 0 ? formatCurrency(listedPrice, currency) : 'Free'}
            </Text>
          </View>

          {/* Offer amount input */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Your offer *</Text>
            <View className="flex-row items-center border-2 border-border rounded-xl px-4 py-3 bg-card">
              <TextInput
                className="flex-1 text-2xl font-bold text-foreground"
                placeholder="0.00"
                placeholderTextColor="#9CA3AF"
                value={offerAmount}
                onChangeText={setOfferAmount}
                keyboardType="decimal-pad"
                autoFocus
              />
              <Text className="text-lg text-muted-foreground ml-2">{currency}</Text>
            </View>
            {isLow && (
              <View className="flex-row items-center gap-1.5">
                <Ionicons name="warning-outline" size={14} color="#F59E0B" />
                <Text className="text-xs text-amber-600">
                  This offer is significantly below the listed price
                </Text>
              </View>
            )}
          </View>

          {/* Note */}
          <View className="gap-2">
            <Text className="text-sm font-semibold text-foreground">Note (optional)</Text>
            <TextInput
              className="border border-border rounded-xl px-4 py-3 bg-card text-sm text-foreground min-h-[80px]"
              placeholder="Add a message to the provider..."
              placeholderTextColor="#9CA3AF"
              value={note}
              onChangeText={setNote}
              multiline
              maxLength={500}
            />
          </View>
        </View>

        {/* Submit button */}
        <View className="p-5 pb-8 border-t border-border">
          <Pressable
            className={`w-full py-4 rounded-xl items-center justify-center flex-row gap-2 bg-primary ${
              !isValid || createBooking.isPending ? 'opacity-50' : ''
            }`}
            onPress={handleSubmit}
            disabled={!isValid || createBooking.isPending}
          >
            {createBooking.isPending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="pricetag-outline" size={20} color="#FFFFFF" />
                <Text className="text-base font-bold text-primary-foreground">
                  Send Offer{isValid ? ` — ${formatCurrency(parsedAmount, currency)}` : ''}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
