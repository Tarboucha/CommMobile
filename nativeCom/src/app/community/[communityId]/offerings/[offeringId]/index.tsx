import { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  Pressable,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { getOffering, deleteOffering } from '@/lib/api/offerings';
import { ScheduleEditor } from '@/components/pages/community/schedule-editor';
import { ScheduleList } from '@/components/pages/community/schedule-list';
import { LoanBookingSheet } from '@/components/booking/loan-booking-sheet';
import { ScheduledBookingSheet } from '@/components/booking/scheduled-booking-sheet';
import { MakeOfferSheet } from '@/components/booking/make-offer-sheet';
import type { Offering } from '@/types/offering';

function getProviderNameFromOffering(offering: Offering): string {
  if (offering.profiles) {
    const { first_name, last_name } = offering.profiles;
    if (first_name || last_name) {
      return [first_name, last_name].filter(Boolean).join(' ');
    }
  }
  return 'Unknown';
}

// ─── Booking action — routed by category + transaction type ─────────────────

function BookingAction({ offering }: { offering: Offering }) {
  const [showOfferSheet, setShowOfferSheet] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const replaceWithItem = useCartStore((s) => s.replaceWithItem);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const cartItem = useCartStore((s) =>
    s.items.find(
      (i) =>
        i.offeringId === offering.id && i.scheduleId === null && i.instanceDate === null
    )
  );

  // Route by category + transaction type
  const isProductPurchase =
    offering.category === 'product' && offering.transaction_type === 'purchase';
  const isLoan = offering.category === 'product' && offering.transaction_type === 'loan';
  const isService = offering.category === 'service';
  const isEvent = offering.category === 'event';

  // ─── Product purchase: cart flow ───────────────────────────────────────
  if (isProductPurchase) {
    const handleAddToCart = () => {
      const itemData = {
        offeringId: offering.id,
        offeringTitle: offering.title,
        offeringCategory: 'product' as const,
        priceAmount: offering.price_amount ?? 0,
        currencyCode: offering.currency_code,
        providerId: offering.provider_id,
        providerName: getProviderNameFromOffering(offering),
        communityId: offering.community_id,
        imageUrl: offering.image_url,
        offeringVersion: offering.version,
        scheduleId: null,
        instanceDate: null,
        fulfillmentMethod: offering.fulfillment_method,
        deliveryFeeAmount: offering.delivery_fee_amount ?? null,
      };

      const result = addItem(itemData);

      if (result.status === 'provider_conflict') {
        Alert.alert(
          'Replace your order?',
          `Your order already has items from ${result.existingProviderName}. Replace them with this item?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Replace',
              style: 'destructive',
              onPress: () => replaceWithItem(itemData),
            },
          ]
        );
      }
    };

    if (cartItem) {
      return (
        <View className="flex-row items-center gap-3">
          <View className="flex-row items-center gap-3 flex-1">
            <Pressable
              onPress={() => updateQuantity(cartItem.cartItemKey, cartItem.quantity - 1)}
              className="w-10 h-10 rounded-full border border-border items-center justify-center active:bg-muted"
            >
              <Ionicons name="remove" size={18} color="#78716C" />
            </Pressable>
            <Text className="text-lg font-bold text-foreground">{cartItem.quantity}</Text>
            <Pressable
              onPress={() => updateQuantity(cartItem.cartItemKey, cartItem.quantity + 1)}
              className="w-10 h-10 rounded-full border border-border items-center justify-center active:bg-muted"
            >
              <Ionicons name="add" size={18} color="#78716C" />
            </Pressable>
          </View>
          <View className="flex-1 py-3 rounded-xl bg-primary/10 items-center">
            <Text className="text-sm font-semibold text-primary">
              In Order ({'\u00d7'}{cartItem.quantity})
            </Text>
          </View>
        </View>
      );
    }

    const hasPriceToNegotiate = (offering.price_amount ?? 0) > 0;

    return (
      <>
        <View className={hasPriceToNegotiate ? 'flex-row gap-2' : ''}>
          <Pressable
            onPress={handleAddToCart}
            className={`flex-row items-center justify-center gap-2 py-3.5 rounded-xl bg-primary active:opacity-80 ${hasPriceToNegotiate ? 'flex-1' : 'w-full'}`}
          >
            <Ionicons name="cart-outline" size={20} color="#FFFFFF" />
            <Text className="text-base font-semibold text-primary-foreground">
              Add to Order
            </Text>
          </Pressable>

          {hasPriceToNegotiate && (
            <Pressable
              onPress={() => setShowOfferSheet(true)}
              className="flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-primary active:opacity-80"
            >
              <Ionicons name="pricetag-outline" size={18} color="#660000" />
              <Text className="text-base font-semibold text-primary">Offer</Text>
            </Pressable>
          )}
        </View>

        {hasPriceToNegotiate && (
          <MakeOfferSheet
            visible={showOfferSheet}
            offering={offering}
            onClose={() => setShowOfferSheet(false)}
          />
        )}
      </>
    );
  }

  // ─── Loan: direct booking via LoanBookingSheet ─────────────────────────
  if (isLoan) {
    return <LoanBookingButton offering={offering} />;
  }

  // ─── Service: scheduled booking sheet ──────────────────────────────────
  if (isService) {
    return <ScheduledBookingButton offering={offering} mode="service" />;
  }

  // ─── Event: scheduled booking sheet (RSVP variant) ─────────────────────
  if (isEvent) {
    return <ScheduledBookingButton offering={offering} mode="event" />;
  }

  return null;
}

// ─── Loan booking button ────────────────────────────────────────────────────

function LoanBookingButton({ offering }: { offering: Offering }) {
  const [showSheet, setShowSheet] = useState(false);

  // Loans don't support the generic "Make an Offer" sheet because it requires
  // loan dates (start + due) which are chosen inside the LoanBookingSheet.
  // Negotiation for loans happens via the booking chat after creating the booking.
  return (
    <>
      <Pressable
        onPress={() => setShowSheet(true)}
        className="w-full flex-row items-center justify-center gap-2 py-3.5 rounded-xl bg-primary active:opacity-80"
      >
        <Ionicons name="arrow-forward-circle-outline" size={20} color="#FFFFFF" />
        <Text className="text-base font-semibold text-primary-foreground">Borrow</Text>
      </Pressable>

      <LoanBookingSheet
        visible={showSheet}
        offering={offering}
        onClose={() => setShowSheet(false)}
      />
    </>
  );
}

// ─── Scheduled booking button (service / event) ────────────────────────────

function ScheduledBookingButton({
  offering,
  mode,
}: {
  offering: Offering;
  mode: 'service' | 'event';
}) {
  const [showSheet, setShowSheet] = useState(false);
  const [showOfferSheet, setShowOfferSheet] = useState(false);

  const isService = mode === 'service';
  const label = isService ? 'Book' : 'RSVP';
  const icon = isService ? 'time-outline' : 'calendar-outline';
  const hasPriceToNegotiate = (offering.price_amount ?? 0) > 0;

  return (
    <>
      <View className={hasPriceToNegotiate ? 'flex-row gap-2' : ''}>
        <Pressable
          onPress={() => setShowSheet(true)}
          className={`flex-row items-center justify-center gap-2 py-3.5 rounded-xl bg-primary active:opacity-80 ${hasPriceToNegotiate ? 'flex-1' : 'w-full'}`}
        >
          <Ionicons name={icon} size={20} color="#FFFFFF" />
          <Text className="text-base font-semibold text-primary-foreground">{label}</Text>
        </Pressable>

        {hasPriceToNegotiate && (
          <Pressable
            onPress={() => setShowOfferSheet(true)}
            className="flex-1 flex-row items-center justify-center gap-2 py-3.5 rounded-xl border-2 border-primary active:opacity-80"
          >
            <Ionicons name="pricetag-outline" size={18} color="#660000" />
            <Text className="text-base font-semibold text-primary">Offer</Text>
          </Pressable>
        )}
      </View>

      <ScheduledBookingSheet
        visible={showSheet}
        offering={offering}
        mode={mode}
        onClose={() => setShowSheet(false)}
      />

      {hasPriceToNegotiate && (
        <MakeOfferSheet
          visible={showOfferSheet}
          offering={offering}
          onClose={() => setShowOfferSheet(false)}
        />
      )}
    </>
  );
}

const CATEGORY_COLORS: Record<string, string> = {
  product: 'bg-blue-100 text-blue-800',
  service: 'bg-green-100 text-green-800',
  event: 'bg-amber-100 text-amber-800',
};

function formatPrice(offering: Offering): string {
  if (!offering.price_amount || offering.price_amount === 0) return 'Free';
  return `${offering.price_amount.toFixed(2)} ${offering.currency_code}`;
}

export default function OfferingDetailScreen() {
  const { offeringId } = useLocalSearchParams<{
    communityId: string;
    offeringId: string;
  }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const [offering, setOffering] = useState<Offering | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showScheduleEditor, setShowScheduleEditor] = useState(false);

  const isProvider = offering?.provider_id === userId;

  const loadOffering = useCallback(async () => {
    if (!offeringId) return;
    try {
      setIsLoading(true);
      const data = await getOffering(offeringId);
      setOffering(data);
    } catch (err) {
      console.error('Failed to load offering:', err);
    } finally {
      setIsLoading(false);
    }
  }, [offeringId]);

  useEffect(() => {
    loadOffering();
  }, [loadOffering]);

  const handleDelete = () => {
    Alert.alert('Delete Offering', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteOffering(offeringId!);
            router.back();
          } catch (err) {
            Alert.alert('Error', 'Failed to delete offering');
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Offering' }} />
        <View className="flex-1 bg-background justify-center items-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (!offering) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Not Found' }} />
        <View className="flex-1 bg-background justify-center items-center p-6">
          <Text className="text-lg text-muted-foreground">Offering not found.</Text>
        </View>
      </>
    );
  }

  const catColors = CATEGORY_COLORS[offering.category] ?? 'bg-muted text-muted-foreground';
  const [catBg, catText] = catColors.split(' ');

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: offering.title }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
      >
        {/* Header */}
        <View className="gap-3 mb-6">
          <View className="flex-row items-center gap-2">
            <View className={`px-3 py-1 rounded-full ${catBg}`}>
              <Text className={`text-xs font-medium capitalize ${catText}`}>
                {offering.category}
              </Text>
            </View>
            <Text className="text-xs text-muted-foreground capitalize">
              {offering.fulfillment_method.replace('_', ' ')}
            </Text>
          </View>

          <Text className="text-2xl font-bold text-foreground">{offering.title}</Text>

          <Text className="text-xl font-semibold text-primary">
            {formatPrice(offering)}
          </Text>

          {offering.description && (
            <Text className="text-sm text-muted-foreground leading-5">
              {offering.description}
            </Text>
          )}

          <View className="flex-row items-center gap-2 mt-1">
            <Ionicons name="person-outline" size={14} color="#78716C" />
            <Text className="text-xs text-muted-foreground">
              by {getProviderNameFromOffering(offering)}
            </Text>
          </View>
        </View>

        {/* Booking action — routed by transaction type */}
        {!isProvider && offering && (
          <View className="mb-6">
            <BookingAction offering={offering} />
          </View>
        )}

        {/* Provider actions */}
        {isProvider && (
          <View className="flex-row gap-3 mb-6">
            <Pressable
              className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-lg border border-destructive"
              onPress={handleDelete}
            >
              <Ionicons name="trash-outline" size={16} color="#DC2626" />
              <Text className="text-sm font-medium text-destructive">Delete</Text>
            </Pressable>
          </View>
        )}

        {/* Schedules */}
        <View className="gap-3">
          <View className="flex-row items-center justify-between">
            <Text className="text-lg font-bold text-foreground">Availability</Text>
            {isProvider && (
              <Pressable
                className="flex-row items-center gap-1 px-3 py-1.5 rounded-lg bg-primary"
                onPress={() => setShowScheduleEditor(true)}
              >
                <Ionicons name="add" size={16} color="#FFFFFF" />
                <Text className="text-xs font-semibold text-primary-foreground">
                  Add Schedule
                </Text>
              </Pressable>
            )}
          </View>

          <ScheduleList
            offeringId={offeringId!}
            schedules={offering.availability_schedules ?? []}
            isProvider={isProvider}
            onRefresh={loadOffering}
          />
        </View>
      </ScrollView>

      {showScheduleEditor && (
        <ScheduleEditor
          offeringId={offeringId!}
          visible={showScheduleEditor}
          onClose={() => setShowScheduleEditor(false)}
          onSaved={loadOffering}
        />
      )}
    </>
  );
}
