import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import type { BookingListItem } from '@/types/booking';

const STATUS_COLORS: Record<string, string> = {
  pending: '#F59E0B',
  confirmed: '#3B82F6',
  in_progress: '#8B5CF6',
  ready: '#10B981',
  completed: '#059669',
  cancelled: '#EF4444',
  loaned_out: '#8B5CF6',
  returned: '#059669',
  overdue: '#DC2626',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  ready: 'Ready',
  completed: 'Completed',
  cancelled: 'Cancelled',
  loaned_out: 'On Loan',
  returned: 'Returned',
  overdue: 'Overdue',
};

function getCustomerName(booking: BookingListItem): string {
  const snap = booking.booking_customer_snapshots;
  if (!snap) return 'Customer';
  if (snap.snapshot_display_name) return snap.snapshot_display_name;
  return [snap.snapshot_first_name, snap.snapshot_last_name].filter(Boolean).join(' ') || 'Customer';
}

interface Props {
  booking: BookingListItem;
  category: string;
  onPress: () => void;
}

export function BookingRow({ booking, category, onPress }: Props) {
  const item = booking.booking_items[0];
  const statusColor = STATUS_COLORS[booking.booking_status] ?? '#6B7280';
  const statusLabel = STATUS_LABELS[booking.booking_status] ?? booking.booking_status;
  const customerName = getCustomerName(booking);

  // Time info for services/events
  const timeStr = item?.instance_start_time ? item.instance_start_time.slice(0, 5) : null;
  const dateStr = item?.instance_date
    ? new Date(item.instance_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  // Loan info
  const loanDueStr = item?.loan_due_date
    ? (() => {
        if (item.loan_returned_at) return 'Returned';
        const due = new Date(item.loan_due_date);
        const days = Math.ceil((due.getTime() - Date.now()) / 86400000);
        if (days < 0) return `Overdue ${Math.abs(days)}d`;
        if (days === 0) return 'Due today';
        if (days === 1) return 'Due tomorrow';
        return `Due in ${days}d`;
      })()
    : null;

  return (
    <Pressable
      className="flex-row items-center py-2.5 px-3 border-t border-border/50 active:bg-muted/30"
      onPress={onPress}
    >
      {/* Left: time or icon */}
      <View className="w-14 items-center mr-2">
        {(category === 'service' || category === 'event') && timeStr ? (
          <Text className="text-sm font-bold text-foreground">{timeStr}</Text>
        ) : category === 'loan' && loanDueStr ? (
          <Text className="text-[10px] font-semibold text-center text-muted-foreground" numberOfLines={1}>
            {loanDueStr}
          </Text>
        ) : (
          <Text className="text-xs text-muted-foreground">
            {item?.quantity > 1 ? `×${item.quantity}` : '—'}
          </Text>
        )}
      </View>

      {/* Center: customer name + date */}
      <View className="flex-1 mr-2">
        <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
          {customerName}
        </Text>
        {dateStr && (category === 'service' || category === 'event') && (
          <Text className="text-xs text-muted-foreground">{dateStr}</Text>
        )}
      </View>

      {/* Right: status */}
      <View className="flex-row items-center gap-1.5">
        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
        <Text className="text-xs font-medium" style={{ color: statusColor }}>
          {statusLabel}
        </Text>
      </View>
    </Pressable>
  );
}
