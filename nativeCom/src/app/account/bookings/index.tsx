import { useMemo, useState } from 'react';
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useMyBookings } from '@/hooks/queries/use-bookings';
import { useRefreshOnFocus } from '@/hooks/queries/use-refresh-on-focus';
import { OfferingBookingGroup, groupBookingsByOffering } from '@/components/pages/bookings/offering-booking-group';
import type { BookingListItem } from '@/types/booking';

// ============================================================================
// Helpers
// ============================================================================

type TabType = 'all' | 'customer' | 'provider';

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: '#F59E0B', bg: 'bg-amber-100' },
  confirmed: { label: 'Confirmed', color: '#3B82F6', bg: 'bg-blue-100' },
  in_progress: { label: 'In Progress', color: '#8B5CF6', bg: 'bg-purple-100' },
  ready: { label: 'Ready', color: '#10B981', bg: 'bg-green-100' },
  completed: { label: 'Completed', color: '#059669', bg: 'bg-emerald-100' },
  cancelled: { label: 'Cancelled', color: '#EF4444', bg: 'bg-red-100' },
  refunded: { label: 'Refunded', color: '#6B7280', bg: 'bg-gray-100' },
  loaned_out: { label: 'On Loan', color: '#8B5CF6', bg: 'bg-purple-100' },
  returned: { label: 'Returned', color: '#059669', bg: 'bg-emerald-100' },
  overdue: { label: 'Overdue', color: '#DC2626', bg: 'bg-red-100' },
};

// ============================================================================
// Component
// ============================================================================

export default function MyBookingsScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  const role = activeTab === 'all' ? undefined : activeTab;
  const { data: bookings, isLoading, isFetching, error, refetch } = useMyBookings(role);
  useRefreshOnFocus(refetch);

  const isProviderTab = activeTab === 'provider';

  // Group bookings by offering for the provider tab
  const offeringGroups = useMemo(
    () => (isProviderTab && bookings ? groupBookingsByOffering(bookings) : []),
    [isProviderTab, bookings]
  );

  const handleBookingPress = (booking: BookingListItem) => {
    router.push({
      pathname: '/booking/[bookingId]',
      params: { bookingId: booking.id },
    });
  };

  // Render
  return (
    <>
      <Stack.Screen options={{ title: 'My Bookings' }} />
      <View className="flex-1 bg-background">
        {/* Tabs */}
        <View className="flex-row border-b border-border">
          <TabButton
            label="All"
            isActive={activeTab === 'all'}
            onPress={() => setActiveTab('all')}
          />
          <TabButton
            label="As Customer"
            isActive={activeTab === 'customer'}
            onPress={() => setActiveTab('customer')}
          />
          <TabButton
            label="As Provider"
            isActive={activeTab === 'provider'}
            onPress={() => setActiveTab('provider')}
          />
        </View>

        {/* Content */}
        {isLoading ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" />
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center p-6 gap-4">
            <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
            <Text className="text-base text-muted-foreground text-center">Failed to load bookings</Text>
            <Pressable className="px-6 py-3 rounded-lg bg-primary" onPress={() => refetch()}>
              <Text className="text-base font-semibold text-primary-foreground">Retry</Text>
            </Pressable>
          </View>
        ) : isProviderTab ? (
          /* Provider view: grouped by offering */
          <FlatList
            data={offeringGroups}
            keyExtractor={(item) => item.offeringId}
            renderItem={({ item }) => <OfferingBookingGroup group={item} />}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            refreshControl={
              <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} />
            }
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center p-6 gap-4 mt-16">
                <View className="w-20 h-20 rounded-full bg-muted items-center justify-center">
                  <Ionicons name="storefront-outline" size={40} color="#9CA3AF" />
                </View>
                <Text className="text-xl font-bold text-center">No bookings yet</Text>
                <Text className="text-base text-center text-muted-foreground">
                  Bookings from customers will appear here.
                </Text>
              </View>
            }
          />
        ) : (
          /* Customer / All view: flat list */
          <FlatList
            data={bookings ?? []}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <BookingCard
                booking={item}
                userId={userId}
                onPress={() => handleBookingPress(item)}
              />
            )}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            refreshControl={
              <RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} />
            }
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center p-6 gap-4 mt-16">
                <View className="w-20 h-20 rounded-full bg-muted items-center justify-center">
                  <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
                </View>
                <Text className="text-xl font-bold text-center">No bookings yet</Text>
                <Text className="text-base text-center text-muted-foreground">
                  Your bookings will appear here once you place one.
                </Text>
              </View>
            }
          />
        )}
      </View>
    </>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function TabButton({
  label,
  isActive,
  onPress,
}: {
  label: string;
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`flex-1 py-3 items-center border-b-2 ${
        isActive ? 'border-primary' : 'border-transparent'
      }`}
      onPress={onPress}
    >
      <Text
        className={`text-sm font-medium ${
          isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  product: { label: 'Order', color: '#3B82F6', bg: 'bg-blue-100', icon: 'bag-outline' },
  service: { label: 'Appointment', color: '#10B981', bg: 'bg-green-100', icon: 'time-outline' },
  event: { label: 'Event', color: '#F59E0B', bg: 'bg-amber-100', icon: 'calendar-outline' },
  loan: { label: 'Loan', color: '#8B5CF6', bg: 'bg-purple-100', icon: 'swap-horizontal-outline' },
};

function getListCategory(items: BookingListItem['booking_items']): string {
  if (items.some((i) => i.is_loan)) return 'loan';
  const cat = items[0]?.snapshot_category;
  if (cat === 'service') return 'service';
  if (cat === 'event') return 'event';
  return 'product';
}

function getContextLine(category: string, item: BookingListItem['booking_items'][0]): string | null {
  if (!item) return null;
  if (category === 'service' || category === 'event') {
    const date = item.instance_date
      ? new Date(item.instance_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      : null;
    const time = item.instance_start_time ? item.instance_start_time.slice(0, 5) : null;
    if (date && time) return `${date} at ${time}`;
    if (date) return date;
    return null;
  }
  if (category === 'loan') {
    if (item.loan_returned_at) return 'Returned';
    if (item.loan_due_date) {
      const due = new Date(item.loan_due_date);
      const now = new Date();
      const daysLeft = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft < 0) return `Overdue by ${Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''}`;
      if (daysLeft === 0) return 'Due today';
      if (daysLeft === 1) return 'Due tomorrow';
      return `Due in ${daysLeft} days`;
    }
    return null;
  }
  // Product: show item count
  return null;
}

function BookingCard({
  booking,
  userId,
  onPress,
}: {
  booking: BookingListItem;
  userId: string | null;
  onPress: () => void;
}) {
  const statusConfig = STATUS_CONFIG[booking.booking_status] || STATUS_CONFIG.pending;
  const isProvider = booking.provider_id === userId;
  const itemCount = booking.booking_items.length;
  const firstItem = booking.booking_items[0];
  const communityName = booking.booking_community_snapshots?.snapshot_community_name;

  const category = getListCategory(booking.booking_items);
  const catConfig = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.product;
  const contextLine = getContextLine(category, firstItem);

  const itemsSummary =
    itemCount === 1
      ? firstItem?.snapshot_title || 'Booking'
      : `${firstItem?.snapshot_title || 'Item'} +${itemCount - 1} more`;

  return (
    <Pressable
      className="rounded-xl bg-card border border-border overflow-hidden active:opacity-80"
      onPress={onPress}
    >
      <View className="flex-row p-4 gap-3">
        {/* Thumbnail */}
        {firstItem?.snapshot_image_url ? (
          <Image
            source={{ uri: firstItem.snapshot_image_url }}
            className="w-14 h-14 rounded-lg"
            resizeMode="cover"
          />
        ) : (
          <View className="w-14 h-14 rounded-lg bg-muted items-center justify-center">
            <Ionicons name={catConfig.icon} size={24} color={catConfig.color} />
          </View>
        )}

        {/* Info */}
        <View className="flex-1 gap-1">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2 flex-1 mr-2">
              {/* Category badge */}
              <View className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full ${catConfig.bg}`}>
                <Ionicons name={catConfig.icon} size={10} color={catConfig.color} />
                <Text className="text-[10px] font-semibold" style={{ color: catConfig.color }}>
                  {catConfig.label}
                </Text>
              </View>
              <Text className="text-sm font-semibold text-muted-foreground" numberOfLines={1}>
                #{booking.booking_number}
              </Text>
            </View>
            {/* Status badge */}
            <View className={`px-2 py-0.5 rounded-full ${statusConfig.bg}`}>
              <Text className="text-xs font-semibold" style={{ color: statusConfig.color }}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <Text className="text-base font-semibold" numberOfLines={1}>
            {itemsSummary}
          </Text>

          {/* Context line: date/time for services, due date for loans */}
          {contextLine && (
            <View className="flex-row items-center gap-1">
              <Ionicons
                name={category === 'loan' ? 'timer-outline' : 'calendar-outline'}
                size={12}
                color="#6B7280"
              />
              <Text className="text-xs text-muted-foreground">{contextLine}</Text>
            </View>
          )}

          <View className="flex-row items-center justify-between mt-0.5">
            <View className="flex-row items-center gap-1">
              {isProvider && (
                <View className="flex-row items-center gap-1 mr-2">
                  <Ionicons name="storefront-outline" size={12} color="#6B7280" />
                  <Text className="text-xs text-muted-foreground">Provider</Text>
                </View>
              )}
              {communityName && (
                <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                  {communityName}
                </Text>
              )}
            </View>
            <Text className="text-sm font-bold">
              {booking.total_amount > 0
                ? formatCurrency(booking.total_amount, booking.currency_code)
                : 'Free'}
            </Text>
          </View>
        </View>

        {/* Chevron */}
        <View className="justify-center">
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </View>
      </View>
    </Pressable>
  );
}
