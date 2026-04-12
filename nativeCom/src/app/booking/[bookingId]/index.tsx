import { useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useBookingDetail } from '@/hooks/queries/use-bookings';
import {
  useReturnLoanItem,
  useUpdateBookingStatus,
} from '@/hooks/queries/use-booking-mutations';
import { handleError } from '@/lib/services/error-service';
import type { BookingItemDetail, BookingStatus } from '@/types/booking';

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function fulfillmentLabel(method: string): string {
  switch (method) {
    case 'delivery': return 'Delivery';
    case 'pickup': return 'Pickup';
    case 'online': return 'Online';
    case 'at_location': return 'At Location';
    default: return method;
  }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  pending: { label: 'Pending', color: '#F59E0B', bg: 'bg-amber-100', icon: 'time-outline' },
  confirmed: { label: 'Confirmed', color: '#3B82F6', bg: 'bg-blue-100', icon: 'checkmark-circle-outline' },
  in_progress: { label: 'In Progress', color: '#8B5CF6', bg: 'bg-purple-100', icon: 'construct-outline' },
  ready: { label: 'Ready', color: '#10B981', bg: 'bg-green-100', icon: 'checkmark-done-circle-outline' },
  completed: { label: 'Completed', color: '#059669', bg: 'bg-emerald-100', icon: 'trophy-outline' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bg: 'bg-red-100', icon: 'close-circle-outline' },
  refunded: { label: 'Refunded', color: '#6B7280', bg: 'bg-gray-100', icon: 'return-down-back-outline' },
  loaned_out: { label: 'On Loan', color: '#8B5CF6', bg: 'bg-purple-100', icon: 'arrow-forward-circle-outline' },
  returned: { label: 'Returned', color: '#059669', bg: 'bg-emerald-100', icon: 'checkmark-done-circle-outline' },
  overdue: { label: 'Overdue', color: '#DC2626', bg: 'bg-red-100', icon: 'alert-circle-outline' },
};

const DEFAULT_STATUS_STEPS: BookingStatus[] = ['pending', 'confirmed', 'in_progress', 'ready', 'completed'];
const LOAN_STATUS_STEPS: BookingStatus[] = ['pending', 'confirmed', 'loaned_out', 'returned', 'completed'];

function formatLoanDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString();
}

// ============================================================================
// Component
// ============================================================================

export default function BookingDetailScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const userId = useAuthStore((s) => s.user?.id ?? null);

  const { data: booking, isLoading, isFetching, error, refetch } = useBookingDetail(bookingId);
  const statusMutation = useUpdateBookingStatus(bookingId!);
  const returnMutation = useReturnLoanItem(bookingId!);
  const isUpdating = statusMutation.isPending || returnMutation.isPending;

  // Determine role
  const isCustomer = booking?.customer_id === userId;
  const isProvider = booking?.provider_id === userId;

  const statusConfig = booking ? STATUS_CONFIG[booking.booking_status] : null;

  // Provider snapshot (from first item, since all items share same provider)
  const providerSnapshot = useMemo(
    () => booking?.booking_items?.[0]?.booking_provider_snapshots ?? null,
    [booking]
  );

  const isLoanBooking = useMemo(
    () => !!booking?.booking_items?.some((item) => item.is_loan),
    [booking]
  );

  const statusSteps = isLoanBooking ? LOAN_STATUS_STEPS : DEFAULT_STATUS_STEPS;

  // Status update handler
  const handleStatusUpdate = useCallback((
    newStatus: BookingStatus,
    cancellationReason?: string
  ) => {
    if (!bookingId || isUpdating) return;
    statusMutation.mutate(
      { booking_status: newStatus, cancellation_reason: cancellationReason },
      {
        onError: (err) => {
          handleError(err, {
            severity: 'alert',
            screen: 'booking-detail',
            userMessage: 'Failed to update booking status.',
          });
        },
      }
    );
  }, [bookingId, isUpdating, statusMutation]);

  // Cancel with reason prompt
  const handleCancel = useCallback(() => {
    Alert.prompt
      ? Alert.prompt(
          'Cancel Booking',
          'Please provide a reason for cancellation (optional):',
          [
            { text: 'Keep Booking', style: 'cancel' },
            {
              text: 'Cancel Booking',
              style: 'destructive',
              onPress: (reason?: string) => handleStatusUpdate('cancelled', reason),
            },
          ],
          'plain-text'
        )
      : Alert.alert(
          'Cancel Booking',
          'Are you sure you want to cancel this booking?',
          [
            { text: 'Keep Booking', style: 'cancel' },
            {
              text: 'Cancel Booking',
              style: 'destructive',
              onPress: () => handleStatusUpdate('cancelled'),
            },
          ]
        );
  }, [handleStatusUpdate]);

  // Provider: mark a loan item as returned
  const handleReturnItem = useCallback((itemId: string) => {
    if (!bookingId || isUpdating) return;
    Alert.alert(
      'Mark as Returned',
      'Confirm the customer has returned this item. This will release the reserved slots.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Returned',
          style: 'default',
          onPress: () => {
            returnMutation.mutate(itemId, {
              onError: (err) => {
                handleError(err, {
                  severity: 'alert',
                  screen: 'booking-detail',
                  userMessage: 'Failed to mark item as returned.',
                });
              },
            });
          },
        },
      ]
    );
  }, [bookingId, isUpdating, returnMutation]);

  // Provider: refuse with reason
  const handleRefuse = useCallback(() => {
    Alert.alert(
      'Refuse Booking',
      'Are you sure you want to refuse this booking? The customer will be notified.',
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Refuse',
          style: 'destructive',
          onPress: () => handleStatusUpdate('cancelled', 'Refused by provider'),
        },
      ]
    );
  }, [handleStatusUpdate]);

  // --- Loading / Error states ---
  if (!bookingId) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <Text className="text-sm text-muted-foreground">Invalid booking.</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Booking Details' }} />
        <View className="flex-1 bg-background justify-center items-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (error || !booking) {
    return (
      <>
        <Stack.Screen options={{ title: 'Booking Details' }} />
        <View className="flex-1 bg-background justify-center items-center p-6 gap-4">
          <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
          <Text className="text-base text-muted-foreground text-center">
            {error ? 'Failed to load booking details' : 'Booking not found'}
          </Text>
          <Pressable className="px-6 py-3 rounded-lg bg-primary" onPress={() => refetch()}>
            <Text className="text-base font-semibold text-primary-foreground">Retry</Text>
          </Pressable>
        </View>
      </>
    );
  }

  const isFinal =
    booking.booking_status === 'completed' ||
    booking.booking_status === 'cancelled' ||
    booking.booking_status === 'refunded' ||
    booking.booking_status === 'returned';

  return (
    <>
      <Stack.Screen
        options={{
          title: `#${booking.booking_number}`,
          headerRight: () => (
            <Pressable
              className="mr-2"
              onPress={() =>
                router.push({
                  pathname: '/booking/[bookingId]/chat',
                  params: {
                    bookingId: booking.id,
                    bookingNumber: booking.booking_number,
                  },
                })
              }
            >
              <Ionicons name="chatbubble-ellipses-outline" size={24} color="#660000" />
            </Pressable>
          ),
        }}
      />

      <View className="flex-1 bg-background">
        <ScrollView
          className="flex-1"
          contentContainerClassName="p-4 pb-40 gap-5"
          refreshControl={
            <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} />
          }
        >
          {/* Status Header */}
          <View className={`p-4 rounded-xl ${statusConfig?.bg ?? 'bg-muted'} items-center gap-2`}>
            <Ionicons name={statusConfig?.icon ?? 'ellipse'} size={32} color={statusConfig?.color} />
            <Text className="text-xl font-bold" style={{ color: statusConfig?.color }}>
              {statusConfig?.label}
            </Text>
            {booking.booking_status === 'cancelled' && booking.cancellation_reason && (
              <Text className="text-sm text-center" style={{ color: statusConfig?.color }}>
                {booking.cancellation_reason}
              </Text>
            )}
          </View>

          {/* Status Timeline */}
          {!isFinal || booking.booking_status === 'completed' ? (
            <StatusTimeline currentStatus={booking.booking_status} steps={statusSteps} />
          ) : null}

          {/* Items */}
          <Section title="Items">
            {booking.booking_items.map((item) => (
              <LoanAwareItemCard
                key={item.id}
                item={item}
                bookingStatus={booking.booking_status}
                isProvider={!!isProvider}
                isUpdating={isUpdating}
                onReturn={handleReturnItem}
              />
            ))}
          </Section>

          {/* Provider Info (customer view) */}
          {isCustomer && providerSnapshot && (
            <Section title="Provider">
              <View className="flex-row items-center p-3 rounded-lg bg-card gap-3">
                {providerSnapshot.snapshot_avatar_url ? (
                  <Image
                    source={{ uri: providerSnapshot.snapshot_avatar_url }}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <View className="w-10 h-10 rounded-full bg-primary/10 justify-center items-center">
                    <Ionicons name="person" size={18} color="#660000" />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-base font-semibold">
                    {providerSnapshot.snapshot_display_name}
                  </Text>
                  {providerSnapshot.snapshot_phone && (
                    <Text className="text-sm text-muted-foreground">
                      {providerSnapshot.snapshot_phone}
                    </Text>
                  )}
                </View>
              </View>
            </Section>
          )}

          {/* Customer Info (provider view) */}
          {isProvider && booking.customer_snapshot && (
            <Section title="Customer">
              <View className="flex-row items-center p-3 rounded-lg bg-card gap-3">
                {booking.customer_snapshot.snapshot_avatar_url ? (
                  <Image
                    source={{ uri: booking.customer_snapshot.snapshot_avatar_url }}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <View className="w-10 h-10 rounded-full bg-primary/10 justify-center items-center">
                    <Ionicons name="person" size={18} color="#660000" />
                  </View>
                )}
                <View className="flex-1">
                  <Text className="text-base font-semibold">
                    {booking.customer_snapshot.snapshot_display_name ??
                      ([booking.customer_snapshot.snapshot_first_name, booking.customer_snapshot.snapshot_last_name]
                        .filter(Boolean)
                        .join(' ') || 'Customer')}
                  </Text>
                  {booking.customer_snapshot.snapshot_phone && (
                    <Text className="text-sm text-muted-foreground">
                      {booking.customer_snapshot.snapshot_phone}
                    </Text>
                  )}
                  {booking.customer_snapshot.snapshot_email && (
                    <Text className="text-sm text-muted-foreground">
                      {booking.customer_snapshot.snapshot_email}
                    </Text>
                  )}
                </View>
              </View>
            </Section>
          )}

          {/* Delivery Address */}
          {booking.delivery_snapshot?.snapshot_addresses && (
            <Section title="Delivery Address">
              <View className="p-3 rounded-lg bg-card gap-1">
                <View className="flex-row items-center gap-2">
                  <Ionicons name="location-outline" size={18} color="#6B7280" />
                  <Text className="text-base">
                    {[
                      booking.delivery_snapshot.snapshot_addresses.street_name,
                      booking.delivery_snapshot.snapshot_addresses.street_number,
                    ].filter(Boolean).join(' ')}
                  </Text>
                </View>
                {booking.delivery_snapshot.snapshot_addresses.apartment_unit && (
                  <Text className="text-sm text-muted-foreground ml-7">
                    {booking.delivery_snapshot.snapshot_addresses.apartment_unit}
                  </Text>
                )}
                <Text className="text-sm text-muted-foreground ml-7">
                  {[
                    booking.delivery_snapshot.snapshot_addresses.postal_code,
                    booking.delivery_snapshot.snapshot_addresses.city,
                  ].filter(Boolean).join(' ')}
                </Text>
                {booking.delivery_snapshot.snapshot_addresses.instructions && (
                  <Text className="text-xs text-muted-foreground italic mt-1 ml-7">
                    {booking.delivery_snapshot.snapshot_addresses.instructions}
                  </Text>
                )}
              </View>
            </Section>
          )}

          {/* Special Instructions */}
          {booking.special_instructions && (
            <Section title="Special Instructions">
              <View className="p-3 rounded-lg bg-card">
                <Text className="text-base text-foreground">{booking.special_instructions}</Text>
              </View>
            </Section>
          )}

          {/* Payment Summary */}
          <Section title="Payment">
            <View className="p-4 rounded-lg bg-card gap-2">
              <Row label="Method" value={booking.payment_method === 'cash' ? 'Cash' : 'External'} />
              <Row label="Subtotal" value={formatCurrency(booking.subtotal_amount, booking.currency_code)} />
              {booking.service_fee_amount > 0 && (
                <Row label="Service Fee" value={formatCurrency(booking.service_fee_amount, booking.currency_code)} />
              )}
              <View className="border-t border-border pt-2 mt-1 flex-row justify-between">
                <Text className="text-base font-bold">Total</Text>
                <Text className="text-base font-bold text-primary">
                  {formatCurrency(booking.total_amount, booking.currency_code)}
                </Text>
              </View>
              {booking.deposit_total > 0 && (
                <View className="border-t border-border pt-2 mt-1 gap-1">
                  <Row
                    label="Deposit (refundable)"
                    value={formatCurrency(booking.deposit_total, booking.currency_code)}
                  />
                  <Row
                    label="Deposit Status"
                    value={depositStatusLabel(booking.deposit_status)}
                  />
                </View>
              )}
            </View>
          </Section>

          {/* Community */}
          {booking.community_snapshot && (
            <Section title="Community">
              <View className="flex-row items-center p-3 rounded-lg bg-card gap-3">
                {booking.community_snapshot.snapshot_community_image_url ? (
                  <Image
                    source={{ uri: booking.community_snapshot.snapshot_community_image_url }}
                    className="w-10 h-10 rounded-lg"
                    resizeMode="cover"
                  />
                ) : (
                  <View className="w-10 h-10 rounded-lg bg-muted items-center justify-center">
                    <Ionicons name="people-outline" size={18} color="#9CA3AF" />
                  </View>
                )}
                <Text className="text-base font-medium flex-1" numberOfLines={1}>
                  {booking.community_snapshot.snapshot_community_name}
                </Text>
              </View>
            </Section>
          )}

          {/* Timestamps */}
          <Section title="Timeline">
            <View className="p-3 rounded-lg bg-card gap-2">
              <Row label="Created" value={new Date(booking.created_at).toLocaleString()} />
              {booking.confirmed_at && (
                <Row label="Confirmed" value={new Date(booking.confirmed_at).toLocaleString()} />
              )}
              {booking.ready_at && (
                <Row label="Ready" value={new Date(booking.ready_at).toLocaleString()} />
              )}
              {booking.completed_at && (
                <Row label="Completed" value={new Date(booking.completed_at).toLocaleString()} />
              )}
              {booking.cancelled_at && (
                <Row label="Cancelled" value={new Date(booking.cancelled_at).toLocaleString()} />
              )}
            </View>
          </Section>
        </ScrollView>

        {/* Action Buttons (sticky bottom) */}
        {!isFinal && (
          <ActionBar
            status={booking.booking_status}
            isProvider={!!isProvider}
            isCustomer={!!isCustomer}
            isLoan={isLoanBooking}
            isUpdating={isUpdating}
            onAccept={() => handleStatusUpdate('confirmed')}
            onRefuse={handleRefuse}
            onStart={() => handleStatusUpdate('in_progress')}
            onMarkReady={() => handleStatusUpdate('ready')}
            onComplete={() => handleStatusUpdate('completed')}
            onMarkLoanedOut={() => handleStatusUpdate('loaned_out')}
            onCancel={handleCancel}
          />
        )}
      </View>
    </>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-lg font-semibold">{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-sm text-muted-foreground">{label}</Text>
      <Text className="text-sm font-medium">{value}</Text>
    </View>
  );
}

function StatusTimeline({
  currentStatus,
  steps,
}: {
  currentStatus: BookingStatus;
  steps: BookingStatus[];
}) {
  const currentIndex = steps.indexOf(currentStatus);

  return (
    <View className="flex-row items-center justify-between px-2">
      {steps.map((step, idx) => {
        const config = STATUS_CONFIG[step];
        const isActive = idx <= currentIndex;
        const isCurrent = step === currentStatus;

        return (
          <View key={step} className="items-center flex-1">
            {/* Connector line */}
            {idx > 0 && (
              <View
                className="absolute top-3 right-1/2 h-0.5"
                style={{
                  backgroundColor: isActive ? config.color : '#D1D5DB',
                  width: '100%',
                  left: '-50%',
                }}
              />
            )}
            {/* Dot */}
            <View
              className="w-6 h-6 rounded-full items-center justify-center z-10"
              style={{
                backgroundColor: isActive ? config.color : '#E5E7EB',
              }}
            >
              {isActive && (
                <Ionicons
                  name={isCurrent ? 'ellipse' : 'checkmark'}
                  size={isCurrent ? 8 : 14}
                  color="#FFFFFF"
                />
              )}
            </View>
            {/* Label */}
            <Text
              className="text-[10px] mt-1 text-center"
              style={{ color: isActive ? config.color : '#9CA3AF' }}
              numberOfLines={1}
            >
              {config.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function ActionBar({
  status,
  isProvider,
  isCustomer,
  isLoan,
  isUpdating,
  onAccept,
  onRefuse,
  onStart,
  onMarkReady,
  onComplete,
  onMarkLoanedOut,
  onCancel,
}: {
  status: BookingStatus;
  isProvider: boolean;
  isCustomer: boolean;
  isLoan: boolean;
  isUpdating: boolean;
  onAccept: () => void;
  onRefuse: () => void;
  onStart: () => void;
  onMarkReady: () => void;
  onComplete: () => void;
  onMarkLoanedOut: () => void;
  onCancel: () => void;
}) {
  const buttons: Array<{
    label: string;
    onPress: () => void;
    variant: 'primary' | 'danger' | 'secondary';
    icon: keyof typeof Ionicons.glyphMap;
  }> = [];

  if (isProvider) {
    switch (status) {
      case 'pending':
        buttons.push(
          { label: 'Accept', onPress: onAccept, variant: 'primary', icon: 'checkmark-circle' },
          { label: 'Refuse', onPress: onRefuse, variant: 'danger', icon: 'close-circle' },
        );
        break;
      case 'confirmed':
        if (isLoan) {
          buttons.push(
            { label: 'Mark Loaned Out', onPress: onMarkLoanedOut, variant: 'primary', icon: 'arrow-forward-circle' },
            { label: 'Cancel', onPress: onCancel, variant: 'danger', icon: 'close-circle' },
          );
        } else {
          buttons.push(
            { label: 'Start', onPress: onStart, variant: 'primary', icon: 'play-circle' },
            { label: 'Cancel', onPress: onCancel, variant: 'danger', icon: 'close-circle' },
          );
        }
        break;
      case 'in_progress':
        buttons.push(
          { label: 'Mark Ready', onPress: onMarkReady, variant: 'primary', icon: 'checkmark-done-circle' },
          { label: 'Cancel', onPress: onCancel, variant: 'danger', icon: 'close-circle' },
        );
        break;
      case 'ready':
        buttons.push(
          { label: 'Complete', onPress: onComplete, variant: 'primary', icon: 'trophy' },
        );
        break;
      case 'loaned_out':
        // Individual return buttons live on the item cards (supports per-item returns)
        break;
    }
  }

  if (isCustomer) {
    if (status === 'pending' || status === 'confirmed') {
      buttons.push(
        { label: 'Cancel Booking', onPress: onCancel, variant: 'danger', icon: 'close-circle' },
      );
    }
  }

  if (buttons.length === 0) return null;

  const variantStyles = {
    primary: 'bg-primary',
    danger: 'bg-red-500',
    secondary: 'bg-muted',
  };

  const textStyles = {
    primary: 'text-primary-foreground',
    danger: 'text-white',
    secondary: 'text-foreground',
  };

  return (
    <View className="absolute bottom-0 left-0 right-0 p-4 pb-8 bg-background border-t border-border flex-row gap-3">
      {buttons.map((btn) => (
        <Pressable
          key={btn.label}
          className={`flex-1 py-3.5 rounded-xl items-center justify-center flex-row gap-2 ${variantStyles[btn.variant]} ${isUpdating ? 'opacity-50' : ''}`}
          onPress={btn.onPress}
          disabled={isUpdating}
        >
          {isUpdating ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Ionicons
                name={btn.icon}
                size={20}
                color={btn.variant === 'secondary' ? '#374151' : '#FFFFFF'}
              />
              <Text className={`text-base font-semibold ${textStyles[btn.variant]}`}>
                {btn.label}
              </Text>
            </>
          )}
        </Pressable>
      ))}
    </View>
  );
}

function depositStatusLabel(value: string): string {
  switch (value) {
    case 'none': return 'None';
    case 'pending': return 'Pending';
    case 'held': return 'Held';
    case 'refunded': return 'Refunded';
    case 'forfeited': return 'Forfeited';
    default: return value;
  }
}

function LoanAwareItemCard({
  item,
  bookingStatus,
  isProvider,
  isUpdating,
  onReturn,
}: {
  item: BookingItemDetail;
  bookingStatus: BookingStatus;
  isProvider: boolean;
  isUpdating: boolean;
  onReturn: (itemId: string) => void;
}) {
  const canReturn =
    isProvider &&
    item.is_loan &&
    !item.loan_returned_at &&
    (bookingStatus === 'loaned_out' || bookingStatus === 'overdue');

  return (
    <View className="p-3 rounded-lg bg-card gap-3">
      <View className="flex-row gap-3">
        {item.snapshot_image_url ? (
          <Image
            source={{ uri: item.snapshot_image_url }}
            className="w-14 h-14 rounded-lg"
            resizeMode="cover"
          />
        ) : (
          <View className="w-14 h-14 rounded-lg bg-muted items-center justify-center">
            <Ionicons name="image-outline" size={24} color="#9CA3AF" />
          </View>
        )}
        <View className="flex-1 gap-1">
          <Text className="text-base font-semibold" numberOfLines={2}>
            {item.snapshot_title}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
              {fulfillmentLabel(item.fulfillment_method)}
            </Text>
            {!item.is_loan && item.instance_date && (
              <Text className="text-xs text-muted-foreground">
                {new Date(item.instance_date).toLocaleDateString()}
              </Text>
            )}
            {item.instance_start_time && item.instance_end_time && (
              <Text className="text-xs text-muted-foreground px-2 py-0.5 rounded bg-muted">
                {item.instance_start_time.slice(0, 5)} – {item.instance_end_time.slice(0, 5)}
              </Text>
            )}
          </View>
          {item.special_instructions && (
            <Text className="text-xs text-muted-foreground italic" numberOfLines={2}>
              "{item.special_instructions}"
            </Text>
          )}
        </View>
        <View className="items-end gap-1">
          <Text className="text-base font-bold">
            {formatCurrency(item.total_amount, item.currency_code)}
          </Text>
          {item.quantity > 1 && (
            <Text className="text-xs text-muted-foreground">
              {item.quantity} x {formatCurrency(item.unit_price_amount, item.currency_code)}
            </Text>
          )}
          {item.delivery_fee_amount > 0 && (
            <Text className="text-xs text-muted-foreground">
              +{formatCurrency(item.delivery_fee_amount, item.currency_code)} delivery
            </Text>
          )}
        </View>
      </View>

      {item.is_loan && (
        <View className="border-t border-border pt-2 gap-1">
          <View className="flex-row items-center gap-2">
            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
            <Text className="text-xs text-muted-foreground">
              Loan period: {formatLoanDate(item.loan_start_date)} → {formatLoanDate(item.loan_due_date)}
            </Text>
          </View>
          {item.deposit_amount != null && item.deposit_amount > 0 && (
            <View className="flex-row items-center gap-2">
              <Ionicons name="shield-checkmark-outline" size={14} color="#6B7280" />
              <Text className="text-xs text-muted-foreground">
                Deposit: {formatCurrency(item.deposit_amount, item.currency_code)}
              </Text>
            </View>
          )}
          {item.loan_returned_at ? (
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-done-circle-outline" size={14} color="#059669" />
              <Text className="text-xs font-medium" style={{ color: '#059669' }}>
                Returned on {new Date(item.loan_returned_at).toLocaleString()}
              </Text>
            </View>
          ) : (
            <View className="flex-row items-center gap-2">
              <Ionicons name="time-outline" size={14} color="#8B5CF6" />
              <Text className="text-xs font-medium" style={{ color: '#8B5CF6' }}>
                Not yet returned
              </Text>
            </View>
          )}

          {canReturn && (
            <Pressable
              className={`mt-2 py-2.5 rounded-lg bg-primary flex-row items-center justify-center gap-2 ${isUpdating ? 'opacity-50' : ''}`}
              onPress={() => onReturn(item.id)}
              disabled={isUpdating}
            >
              <Ionicons name="return-down-back-outline" size={18} color="#FFFFFF" />
              <Text className="text-sm font-semibold text-primary-foreground">
                Mark as Returned
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}
