import { useState } from 'react';
import { View, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { BookingRow } from './booking-row';
import type { BookingListItem } from '@/types/booking';

const MAX_VISIBLE = 3;

const CATEGORY_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  product: { label: 'Order', color: '#3B82F6', bg: 'bg-blue-100', icon: 'bag-outline' },
  service: { label: 'Appointment', color: '#10B981', bg: 'bg-green-100', icon: 'time-outline' },
  event: { label: 'Event', color: '#F59E0B', bg: 'bg-amber-100', icon: 'calendar-outline' },
  loan: { label: 'Loan', color: '#8B5CF6', bg: 'bg-purple-100', icon: 'swap-horizontal-outline' },
};

function getCategory(items: BookingListItem['booking_items']): string {
  if (items.some((i) => i.is_loan)) return 'loan';
  const cat = items[0]?.snapshot_category;
  if (cat === 'service') return 'service';
  if (cat === 'event') return 'event';
  return 'product';
}

function getStatusCounts(bookings: BookingListItem[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const b of bookings) {
    const s = b.booking_status;
    counts[s] = (counts[s] || 0) + 1;
  }
  return counts;
}

const STATUS_EMOJI: Record<string, string> = {
  pending: '🟡',
  confirmed: '🔵',
  in_progress: '🟣',
  ready: '🟢',
  completed: '✅',
  cancelled: '🔴',
  loaned_out: '🟣',
  returned: '✅',
  overdue: '🔴',
};

interface OfferingGroup {
  offeringId: string;
  offeringTitle: string;
  offeringImage: string | null;
  category: string;
  bookings: BookingListItem[];
}

interface Props {
  group: OfferingGroup;
}

export function OfferingBookingGroup({ group }: Props) {
  const [expanded, setExpanded] = useState(false);
  const catConfig = CATEGORY_CONFIG[group.category] || CATEGORY_CONFIG.product;
  const statusCounts = getStatusCounts(group.bookings);
  const total = group.bookings.length;

  // Sort: pending first, then by date desc
  const sorted = [...group.bookings].sort((a, b) => {
    const aP = a.booking_status === 'pending' ? 0 : 1;
    const bP = b.booking_status === 'pending' ? 0 : 1;
    if (aP !== bP) return aP - bP;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const visible = expanded ? sorted : sorted.slice(0, MAX_VISIBLE);
  const hasMore = total > MAX_VISIBLE;

  const handleBookingPress = (booking: BookingListItem) => {
    router.push({ pathname: '/booking/[bookingId]', params: { bookingId: booking.id } });
  };

  // Status summary string
  const statusSummary = Object.entries(statusCounts)
    .filter(([_, count]) => count > 0)
    .map(([status, count]) => `${STATUS_EMOJI[status] || '⚪'} ${count} ${status.replace('_', ' ')}`)
    .join('  ');

  return (
    <View className="rounded-xl bg-card border border-border overflow-hidden">
      {/* Group header */}
      <View className="flex-row p-4 gap-3">
        {group.offeringImage ? (
          <Image source={{ uri: group.offeringImage }} className="w-12 h-12 rounded-lg" resizeMode="cover" />
        ) : (
          <View className="w-12 h-12 rounded-lg bg-muted items-center justify-center">
            <Ionicons name={catConfig.icon} size={22} color={catConfig.color} />
          </View>
        )}

        <View className="flex-1 gap-1">
          <View className="flex-row items-center justify-between">
            <Text className="text-base font-bold text-foreground flex-1 mr-2" numberOfLines={1}>
              {group.offeringTitle}
            </Text>
            <View className={`flex-row items-center gap-1 px-2 py-0.5 rounded-full ${catConfig.bg}`}>
              <Ionicons name={catConfig.icon} size={10} color={catConfig.color} />
              <Text className="text-[10px] font-semibold" style={{ color: catConfig.color }}>
                {catConfig.label}
              </Text>
            </View>
          </View>

          <Text className="text-xs text-muted-foreground">
            {total} booking{total !== 1 ? 's' : ''}
          </Text>

          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            {statusSummary}
          </Text>
        </View>
      </View>

      {/* Booking rows */}
      <View>
        {visible.map((booking) => (
          <BookingRow
            key={booking.id}
            booking={booking}
            category={group.category}
            onPress={() => handleBookingPress(booking)}
          />
        ))}
      </View>

      {/* View all / collapse */}
      {hasMore && (
        <Pressable
          className="flex-row items-center justify-center py-2.5 border-t border-border/50"
          onPress={() => setExpanded(!expanded)}
        >
          <Text className="text-xs font-semibold text-primary mr-1">
            {expanded ? 'Show less' : `View all ${total} bookings`}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#660000"
          />
        </Pressable>
      )}
    </View>
  );
}

/**
 * Groups a flat list of bookings by offering_id.
 * Returns sorted groups (most recent booking first).
 */
export function groupBookingsByOffering(bookings: BookingListItem[]): OfferingGroup[] {
  const map = new Map<string, OfferingGroup>();

  for (const b of bookings) {
    const item = b.booking_items[0];
    if (!item) continue;

    const key = item.offering_id;

    if (!map.has(key)) {
      map.set(key, {
        offeringId: key,
        offeringTitle: item.snapshot_title,
        offeringImage: item.snapshot_image_url,
        category: getCategory(b.booking_items),
        bookings: [],
      });
    }

    map.get(key)!.bookings.push(b);
  }

  // Sort groups: groups with pending bookings first, then by most recent booking
  return [...map.values()].sort((a, b) => {
    const aHasPending = a.bookings.some((bk) => bk.booking_status === 'pending') ? 0 : 1;
    const bHasPending = b.bookings.some((bk) => bk.booking_status === 'pending') ? 0 : 1;
    if (aHasPending !== bHasPending) return aHasPending - bHasPending;

    const aLatest = Math.max(...a.bookings.map((bk) => new Date(bk.created_at).getTime()));
    const bLatest = Math.max(...b.bookings.map((bk) => new Date(bk.created_at).getTime()));
    return bLatest - aLatest;
  });
}
