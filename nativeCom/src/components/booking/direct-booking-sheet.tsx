import { useState, type ReactNode } from 'react';
import {
  Modal,
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useCreateBooking } from '@/hooks/queries/use-booking-mutations';
import { handleError } from '@/lib/services/error-service';
import { buildDirectBookingPayload, type DirectBookingParams } from '@/lib/direct-booking';
import { AddressSelector } from '@/components/pages/booking/address-selector';
import { PaymentMethodSelector } from '@/components/pages/booking/payment-method-selector';
import { PhoneNumberDisplay } from '@/components/pages/booking/phone-number-display';
import type { Offering } from '@/types/offering';

interface DirectBookingSheetProps {
  visible: boolean;
  offering: Offering;
  /** Title shown in the sheet header (e.g. "Borrow", "Book Service", "RSVP") */
  title: string;
  /** Label for the confirm button (e.g. "Confirm Borrow", "Book") */
  confirmLabel?: string;
  /** Total price for the booking — when > 0 the "Make an Offer" toggle is shown */
  totalPrice?: number;
  /** Currency code used in the offer input (defaults to offering.currency_code) */
  currencyCode?: string;
  /**
   * Optional content rendered above the standard fields.
   * Used by the loan sheet to show date pickers, etc.
   */
  customContent?: ReactNode;
  /**
   * Extra parameters that will be merged into the direct booking payload.
   * Loan-specific fields (loanStartDate, loanDueDate) come from here.
   */
  bookingParams?: Partial<DirectBookingParams>;
  /**
   * Lines added to the summary section (e.g. "Rental fee", "Deposit").
   * If omitted, only the offering price is shown.
   */
  summaryLines?: { label: string; value: string }[];
  /** Total amount displayed at the bottom (currency-formatted string) */
  totalLabel?: string;
  /** When true, the confirm button is disabled (e.g. no time slot selected) */
  confirmDisabled?: boolean;
  onClose: () => void;
}

export function DirectBookingSheet({
  visible,
  offering,
  title,
  confirmLabel = 'Confirm Booking',
  totalPrice = 0,
  currencyCode,
  customContent,
  bookingParams,
  summaryLines,
  totalLabel,
  confirmDisabled = false,
  onClose,
}: DirectBookingSheetProps) {
  const router = useRouter();
  const createBooking = useCreateBooking();

  const [paymentMethod, setPaymentMethod] = useState<string | null>('cash');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [makeOffer, setMakeOffer] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNote, setOfferNote] = useState('');

  const isDelivery = offering.fulfillment_method === 'delivery';
  const isPickup = offering.fulfillment_method === 'pickup';
  const offerCurrency = currencyCode ?? offering.currency_code ?? 'EUR';

  const parsedOffer = (() => {
    const n = parseFloat(offerAmount.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  })();
  const offerInvalid = makeOffer && (parsedOffer === null || parsedOffer === totalPrice);
  const offerIsLow = makeOffer && parsedOffer !== null && totalPrice > 0 && parsedOffer < totalPrice * 0.5;
  const offerActive = makeOffer && parsedOffer !== null && parsedOffer !== totalPrice;

  const canSubmit =
    !!paymentMethod &&
    (!isDelivery || !!selectedAddressId) &&
    !createBooking.isPending &&
    !confirmDisabled &&
    !offerInvalid;

  const handleConfirm = async () => {
    if (!canSubmit) return;

    if (isDelivery && !selectedAddressId) {
      Alert.alert('Address Required', 'Please select a delivery address.');
      return;
    }

    try {
      const payload = buildDirectBookingPayload({
        offering,
        paymentMethod: paymentMethod as 'cash' | 'external',
        deliveryAddressId: selectedAddressId,
        specialInstructions: specialInstructions || undefined,
        contactPhone: contactPhone || undefined,
        ...(offerActive && parsedOffer !== null && { offerAmount: parsedOffer }),
        ...(offerActive && offerNote.trim() && { offerNote: offerNote.trim() }),
        ...bookingParams,
      });

      const booking = await createBooking.mutateAsync(payload);

      onClose();
      router.replace({
        pathname: '/booking/success',
        params: {
          bookingIds: booking.id,
          bookingNumbers: booking.booking_number,
        },
      });
    } catch (error) {
      handleError(error, {
        severity: 'alert',
        screen: 'direct-booking-sheet',
        userMessage: 'Failed to place booking. Please try again.',
      });
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-background">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
          <Pressable onPress={onClose} className="w-10 h-10 items-center justify-center">
            <Ionicons name="close" size={24} color="#1F2937" />
          </Pressable>
          <Text className="text-lg font-semibold">{title}</Text>
          <View className="w-10" />
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            className="flex-1"
            contentContainerClassName="p-4 gap-6 pb-32"
            keyboardShouldPersistTaps="handled"
          >
            {/* Offering header */}
            <View className="gap-1">
              <Text className="text-base font-bold text-foreground">{offering.title}</Text>
              {offering.description && (
                <Text className="text-sm text-muted-foreground" numberOfLines={2}>
                  {offering.description}
                </Text>
              )}
            </View>

            {/* Custom content (e.g. loan date picker) */}
            {customContent}

            {/* Delivery address (if applicable) */}
            {isDelivery && (
              <AddressSelector
                selectedAddressId={selectedAddressId}
                onSelect={setSelectedAddressId}
              />
            )}

            {/* Payment method */}
            <PaymentMethodSelector
              fulfillmentMethod={offering.fulfillment_method}
              selectedMethod={paymentMethod}
              onSelect={setPaymentMethod}
              acceptsOnlinePayment={false}
              cashOnDeliveryEnabled={isDelivery}
              cashOnPickupEnabled={isPickup}
            />

            {/* Phone */}
            <PhoneNumberDisplay onPhoneChange={(phone) => setContactPhone(phone ?? '')} />

            {/* Special instructions */}
            <View className="gap-2">
              <Text className="text-sm font-semibold">Special Instructions</Text>
              <TextInput
                className="border border-border rounded-lg p-3 text-sm bg-card text-foreground min-h-[80px]"
                placeholder="Any special requests..."
                placeholderTextColor="#9CA3AF"
                value={specialInstructions}
                onChangeText={setSpecialInstructions}
                multiline
                maxLength={1000}
                textAlignVertical="top"
              />
            </View>

            {/* Make an Offer (only when there's a price) */}
            {totalPrice > 0 && (
              <View className="p-4 rounded-lg bg-card gap-3">
                <Pressable
                  className="flex-row items-center gap-2"
                  onPress={() => setMakeOffer((v) => !v)}
                >
                  <Ionicons
                    name={makeOffer ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={makeOffer ? '#10B981' : '#6B7280'}
                  />
                  <Text className="text-sm font-semibold flex-1">
                    Make an offer instead of paying full price
                  </Text>
                </Pressable>

                {makeOffer && (
                  <View className="gap-3 pt-2">
                    <View className="flex-row items-center gap-3">
                      <View className="flex-1">
                        <Text className="text-xs text-muted-foreground">Listed price</Text>
                        <Text className="text-base font-medium line-through text-muted-foreground">
                          {totalPrice.toFixed(2)} {offerCurrency}
                        </Text>
                      </View>
                      <View className="flex-1">
                        <Text className="text-xs text-muted-foreground">Your offer</Text>
                        <View className="flex-row items-center border border-border rounded-lg bg-background px-3">
                          <TextInput
                            className="flex-1 py-2 text-base text-foreground"
                            placeholder="0.00"
                            placeholderTextColor="#9CA3AF"
                            value={offerAmount}
                            onChangeText={setOfferAmount}
                            keyboardType="decimal-pad"
                          />
                          <Text className="text-sm text-muted-foreground">{offerCurrency}</Text>
                        </View>
                      </View>
                    </View>

                    {offerInvalid && offerAmount.length > 0 && (
                      <Text className="text-xs text-destructive">
                        {parsedOffer === totalPrice
                          ? 'Offer matches listed price — uncheck to place a regular booking.'
                          : 'Enter a valid amount.'}
                      </Text>
                    )}

                    {offerIsLow && (
                      <Text className="text-xs text-amber-600">
                        That's a low offer — provider may decline.
                      </Text>
                    )}

                    <View className="gap-1">
                      <Text className="text-xs text-muted-foreground">Note (optional)</Text>
                      <TextInput
                        className="border border-border rounded-lg p-3 text-sm bg-background text-foreground min-h-[60px]"
                        placeholder="Why this price? (optional)"
                        placeholderTextColor="#9CA3AF"
                        value={offerNote}
                        onChangeText={setOfferNote}
                        multiline
                        maxLength={500}
                        textAlignVertical="top"
                      />
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Summary */}
            {summaryLines && summaryLines.length > 0 && (
              <View className="p-4 rounded-lg bg-card gap-2">
                <Text className="text-sm font-semibold mb-1">Summary</Text>
                {summaryLines.map((line, i) => (
                  <View key={i} className="flex-row justify-between">
                    <Text className="text-sm text-muted-foreground">{line.label}</Text>
                    <Text className="text-sm font-medium">{line.value}</Text>
                  </View>
                ))}
                {totalLabel && (
                  <View className="border-t border-border pt-2 mt-1 flex-row justify-between">
                    <Text className="text-base font-bold">Total</Text>
                    <Text className="text-base font-bold text-primary">{totalLabel}</Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          {/* Sticky confirm button */}
          <View className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-background border-t border-border">
            <Pressable
              className={`w-full py-4 rounded-xl items-center justify-center bg-primary ${
                !canSubmit ? 'opacity-50' : ''
              }`}
              onPress={handleConfirm}
              disabled={!canSubmit}
            >
              {createBooking.isPending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <View className="flex-row items-center gap-2">
                  <Ionicons
                    name={offerActive ? 'pricetag' : 'checkmark-circle'}
                    size={22}
                    color="#FFFFFF"
                  />
                  <Text className="text-base font-bold text-primary-foreground">
                    {offerActive
                      ? `Send with Offer — ${parsedOffer!.toFixed(2)} ${offerCurrency}`
                      : confirmLabel}
                  </Text>
                </View>
              )}
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}
