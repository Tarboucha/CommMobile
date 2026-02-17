import { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { Stack, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getMyBookings } from '@/lib/api/bookings';
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
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// ============================================================================
// Component
// ============================================================================

export default function MyBookingsScreen() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [bookings, setBookings] = useState<BookingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [error, setError] = useState<string | null>(null);

  const loadBookings = useCallback(async (silent = false) => {
    try {
      if (!silent) setIsLoading(true);
      setError(null);
      const role = activeTab === 'all' ? undefined : activeTab;
      const data = await getMyBookings(role);
      setBookings(data);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setError('Failed to load bookings');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [activeTab]);

  // Reload on focus and tab change
  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadBookings(true);
  }, [loadBookings]);

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
        {isLoading && !isRefreshing ? (
          <View className="flex-1 justify-center items-center">
            <ActivityIndicator size="large" />
          </View>
        ) : error ? (
          <View className="flex-1 justify-center items-center p-6 gap-4">
            <Ionicons name="alert-circle-outline" size={48} color="#9CA3AF" />
            <Text className="text-base text-muted-foreground text-center">{error}</Text>
            <Pressable className="px-6 py-3 rounded-lg bg-primary" onPress={() => loadBookings()}>
              <Text className="text-base font-semibold text-primary-foreground">Retry</Text>
            </Pressable>
          </View>
        ) : (
          <FlatList
            data={bookings}
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
              <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} />
            }
            ListEmptyComponent={
              <View className="flex-1 justify-center items-center p-6 gap-4 mt-16">
                <View className="w-20 h-20 rounded-full bg-muted items-center justify-center">
                  <Ionicons name="receipt-outline" size={40} color="#9CA3AF" />
                </View>
                <Text className="text-xl font-bold text-center">No bookings yet</Text>
                <Text className="text-base text-center text-muted-foreground">
                  {activeTab === 'provider'
                    ? 'Bookings from customers will appear here.'
                    : 'Your bookings will appear here once you place one.'}
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

  // Build items summary text
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
            <Ionicons name="receipt-outline" size={24} color="#9CA3AF" />
          </View>
        )}

        {/* Info */}
        <View className="flex-1 gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-semibold" numberOfLines={1}>
              #{booking.booking_number}
            </Text>
            {/* Status badge */}
            <View className={`px-2 py-0.5 rounded-full ${statusConfig.bg}`}>
              <Text className="text-xs font-semibold" style={{ color: statusConfig.color }}>
                {statusConfig.label}
              </Text>
            </View>
          </View>

          <Text className="text-sm text-muted-foreground" numberOfLines={1}>
            {itemsSummary}
          </Text>

          <View className="flex-row items-center justify-between mt-1">
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
              {formatCurrency(booking.total_amount, booking.currency_code)}
            </Text>
          </View>

          <Text className="text-xs text-muted-foreground">
            {formatDate(booking.created_at)}
          </Text>
        </View>

        {/* Chevron */}
        <View className="justify-center">
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </View>
      </View>
    </Pressable>
  );
}
