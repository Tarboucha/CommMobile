import { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useCartStore, type BookingCartItem } from '@/lib/stores/cart-store';
import { AddressSelector } from '@/components/pages/booking/address-selector';
import { PaymentMethodSelector } from '@/components/pages/booking/payment-method-selector';
import { PhoneNumberDisplay } from '@/components/pages/booking/phone-number-display';
import { createBooking } from '@/lib/api/bookings';
import { generateUUID } from '@/lib/utils/uuid';
import { handleError } from '@/lib/services/error-service';

// --- Helpers ---

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function fulfillmentLabel(method: string): string {
  switch (method) {
    case 'delivery':
      return 'Delivery';
    case 'pickup':
      return 'Pickup';
    case 'online':
      return 'Online';
    case 'at_location':
      return 'At Location';
    default:
      return method;
  }
}

function fulfillmentIcon(method: string): keyof typeof Ionicons.glyphMap {
  switch (method) {
    case 'delivery':
      return 'bicycle-outline';
    case 'pickup':
      return 'storefront-outline';
    case 'online':
      return 'globe-outline';
    case 'at_location':
      return 'location-outline';
    default:
      return 'ellipse-outline';
  }
}

// --- Component ---

export default function BookingReviewScreen() {
  const items = useCartStore((s) => s.items);
  const communityId = useCartStore((s) => s.communityId);
  const providerId = useCartStore((s) => s.providerId);
  const providerName = useCartStore((s) => s.providerName);
  const clearCart = useCartStore((s) => s.clearCart);

  // Form state
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string | null>('cash');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [specialInstructions, setSpecialInstructions] = useState('');
  const [makeOffer, setMakeOffer] = useState(false);
  const [offerAmount, setOfferAmount] = useState('');
  const [offerNote, setOfferNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Derived values
  const hasDeliveryItems = useMemo(
    () => items.some((i) => i.fulfillmentMethod === 'delivery'),
    [items]
  );

  const hasPickupItems = useMemo(
    () => items.some((i) => i.fulfillmentMethod === 'pickup'),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, i) => sum + i.priceAmount * i.quantity, 0),
    [items]
  );

  const deliveryFees = useMemo(
    () =>
      items.reduce((sum, i) => {
        if (i.fulfillmentMethod === 'delivery' && i.deliveryFeeAmount) {
          return sum + i.deliveryFeeAmount * i.quantity;
        }
        return sum;
      }, 0),
    [items]
  );

  const total = subtotal + deliveryFees;
  const currencyCode = items[0]?.currencyCode ?? 'EUR';

  // Offer parsing
  const parsedOffer = useMemo(() => {
    const n = parseFloat(offerAmount.replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [offerAmount]);

  const offerInvalid = makeOffer && (parsedOffer === null || parsedOffer === total);
  const offerIsLow = makeOffer && parsedOffer !== null && parsedOffer < subtotal * 0.5;

  // Validation
  const canSubmit =
    items.length > 0 &&
    paymentMethod &&
    providerId &&
    (!hasDeliveryItems || selectedAddressId) &&
    !offerInvalid &&
    !isSubmitting;

  // --- Handlers ---

  const handlePlaceBooking = async () => {
    if (!canSubmit || !communityId) return;

    if (hasDeliveryItems && !selectedAddressId) {
      Alert.alert('Address Required', 'Please select a delivery address.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Single provider, single booking — no split logic needed
      const includeOffer = makeOffer && parsedOffer !== null && parsedOffer !== total;
      const booking = await createBooking({
        community_id: communityId,
        items: items.map((item) => ({
          offering_id: item.offeringId,
          offering_version: item.offeringVersion,
          quantity: item.quantity,
          fulfillment_method: item.fulfillmentMethod,
          schedule_id: item.scheduleId,
          instance_date: item.instanceDate,
        })),
        payment_method: paymentMethod as 'cash' | 'external',
        delivery_address_id: hasDeliveryItems ? selectedAddressId : null,
        special_instructions: specialInstructions.trim() || undefined,
        contact_phone: contactPhone.trim() || undefined,
        idempotency_key: generateUUID(),
        ...(includeOffer && { offer_amount: parsedOffer }),
        ...(includeOffer && offerNote.trim() && { offer_note: offerNote.trim() }),
      });

      clearCart();
      router.replace({
        pathname: '/booking/success',
        params: {
          bookingIds: booking.id,
          bookingNumbers: booking.booking_number,
        },
      });
    } catch (error) {
      setIsSubmitting(false);
      handleError(error, {
        severity: 'alert',
        screen: 'booking-review',
        userMessage: 'Failed to place booking. Please try again.',
      });
    }
  };

  // --- Empty cart guard ---
  if (items.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: 'Review Booking' }} />
        <View className="flex-1 bg-background justify-center items-center p-6 gap-4">
          <Ionicons name="cart-outline" size={64} color="#9CA3AF" />
          <Text className="text-xl font-bold text-center">Your cart is empty</Text>
          <Text className="text-base text-center text-muted-foreground">
            Add items from the community board to get started.
          </Text>
          <Pressable
            className="mt-4 px-6 py-3 rounded-lg bg-primary"
            onPress={() => router.back()}
          >
            <Text className="text-base font-semibold text-primary-foreground">Go Back</Text>
          </Pressable>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Review Booking' }} />
      <View className="flex-1 bg-background">
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-40 gap-6"
          keyboardShouldPersistTaps="handled"
        >
          {/* Provider header */}
          {providerName && (
            <View className="flex-row items-center gap-2">
              <Ionicons name="person-circle-outline" size={20} color="#6B7280" />
              <Text className="text-base font-semibold text-muted-foreground">
                Order from {providerName}
              </Text>
            </View>
          )}

          {/* Items */}
          <View className="gap-3">
            <Text className="text-lg font-semibold">Items</Text>
            {items.map((item) => (
              <ItemRow key={item.cartItemKey} item={item} currencyCode={currencyCode} />
            ))}
          </View>

          {/* Delivery Address (conditional) */}
          {hasDeliveryItems && (
            <AddressSelector
              selectedAddressId={selectedAddressId}
              onSelect={setSelectedAddressId}
            />
          )}

          {/* Payment Method */}
          <PaymentMethodSelector
            fulfillmentMethod={
              hasDeliveryItems ? 'delivery' : hasPickupItems ? 'pickup' : items[0]?.fulfillmentMethod ?? null
            }
            selectedMethod={paymentMethod}
            onSelect={setPaymentMethod}
            acceptsOnlinePayment={false}
            cashOnDeliveryEnabled={hasDeliveryItems}
            cashOnPickupEnabled={hasPickupItems}
          />

          {/* Phone Number */}
          <PhoneNumberDisplay onPhoneChange={(phone) => setContactPhone(phone ?? '')} />

          {/* Special Instructions */}
          <View className="gap-2">
            <Text className="text-lg font-semibold">Special Instructions</Text>
            <TextInput
              className="border border-border rounded-lg p-3 text-base bg-card text-foreground min-h-[80px]"
              placeholder="Any special requests for your booking..."
              placeholderTextColor="#9CA3AF"
              value={specialInstructions}
              onChangeText={setSpecialInstructions}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />
            <Text className="text-xs text-muted-foreground text-right">
              {specialInstructions.length}/1000
            </Text>
          </View>

          {/* Make an Offer (only if there's a price > 0) */}
          {total > 0 && (
            <View className="p-4 rounded-lg bg-card gap-3">
              <Pressable
                className="flex-row items-center justify-between"
                onPress={() => setMakeOffer((v) => !v)}
              >
                <View className="flex-row items-center gap-2 flex-1">
                  <Ionicons
                    name={makeOffer ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={makeOffer ? '#10B981' : '#6B7280'}
                  />
                  <Text className="text-base font-semibold flex-1">
                    Make an offer instead of paying full price
                  </Text>
                </View>
              </Pressable>

              {makeOffer && (
                <View className="gap-3 pt-2">
                  <View className="flex-row items-center gap-3">
                    <View className="flex-1">
                      <Text className="text-xs text-muted-foreground">Listed price</Text>
                      <Text className="text-base font-medium line-through text-muted-foreground">
                        {formatCurrency(total, currencyCode)}
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
                        <Text className="text-sm text-muted-foreground">{currencyCode}</Text>
                      </View>
                    </View>
                  </View>

                  {offerInvalid && offerAmount.length > 0 && (
                    <Text className="text-xs text-destructive">
                      {parsedOffer === total
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

          {/* Order Summary */}
          <View className="p-4 rounded-lg bg-card gap-3">
            <Text className="text-lg font-semibold">Summary</Text>

            <View className="flex-row justify-between">
              <Text className="text-base text-muted-foreground">Subtotal</Text>
              <Text className="text-base font-medium">
                {formatCurrency(subtotal, currencyCode)}
              </Text>
            </View>

            {deliveryFees > 0 && (
              <View className="flex-row justify-between">
                <Text className="text-base text-muted-foreground">Delivery Fees</Text>
                <Text className="text-base font-medium">
                  {formatCurrency(deliveryFees, currencyCode)}
                </Text>
              </View>
            )}

            <View className="border-t border-border pt-3 flex-row justify-between">
              <Text className="text-lg font-bold">Total</Text>
              <Text className="text-lg font-bold text-primary">
                {formatCurrency(total, currencyCode)}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Place Booking Button (sticky bottom) */}
        <View className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-background border-t border-border">
          <Pressable
            className={`w-full py-4 rounded-xl items-center justify-center bg-primary ${!canSubmit ? 'opacity-50' : ''}`}
            onPress={handlePlaceBooking}
            disabled={!canSubmit}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View className="flex-row items-center gap-2">
                <Ionicons
                  name={makeOffer && parsedOffer !== null ? 'pricetag' : 'checkmark-circle'}
                  size={22}
                  color="#FFFFFF"
                />
                <Text className="text-base font-bold text-primary-foreground">
                  {makeOffer && parsedOffer !== null
                    ? `Send Booking with Offer — ${formatCurrency(parsedOffer, currencyCode)}`
                    : `Place Booking — ${formatCurrency(total, currencyCode)}`}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>
    </>
  );
}

// --- Item Row Component ---

function ItemRow({ item, currencyCode }: { item: BookingCartItem; currencyCode: string }) {
  const itemTotal = item.priceAmount * item.quantity;
  const hasDeliveryFee =
    item.fulfillmentMethod === 'delivery' && item.deliveryFeeAmount && item.deliveryFeeAmount > 0;

  return (
    <View className="flex-row p-3 rounded-lg bg-card gap-3">
      {/* Image */}
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          className="w-14 h-14 rounded-lg"
          resizeMode="cover"
        />
      ) : (
        <View className="w-14 h-14 rounded-lg bg-muted items-center justify-center">
          <Ionicons name="image-outline" size={24} color="#9CA3AF" />
        </View>
      )}

      {/* Details */}
      <View className="flex-1 gap-1">
        <Text className="text-base font-semibold" numberOfLines={1}>
          {item.offeringTitle}
        </Text>
        <Text className="text-sm text-muted-foreground" numberOfLines={1}>
          by {item.providerName}
        </Text>
        <View className="flex-row items-center gap-2">
          <View className="flex-row items-center gap-1 px-2 py-0.5 rounded bg-muted">
            <Ionicons
              name={fulfillmentIcon(item.fulfillmentMethod)}
              size={12}
              color="#6B7280"
            />
            <Text className="text-xs text-muted-foreground">
              {fulfillmentLabel(item.fulfillmentMethod)}
            </Text>
          </View>
          {hasDeliveryFee && (
            <Text className="text-xs text-muted-foreground">
              +{formatCurrency(item.deliveryFeeAmount! * item.quantity, currencyCode)} delivery
            </Text>
          )}
        </View>
      </View>

      {/* Price & Quantity */}
      <View className="items-end gap-1">
        <Text className="text-base font-bold">
          {formatCurrency(itemTotal, currencyCode)}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {item.quantity > 1
            ? `${item.quantity} × ${formatCurrency(item.priceAmount, currencyCode)}`
            : `× ${item.quantity}`}
        </Text>
      </View>
    </View>
  );
}
