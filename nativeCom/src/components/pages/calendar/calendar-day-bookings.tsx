import { View, FlatList, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import type { CalendarEntry } from '@/types/booking';

const CATEGORY_CONFIG: Record<string, { color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  product: { color: '#3B82F6', icon: 'bag-outline' },
  service: { color: '#10B981', icon: 'time-outline' },
  event: { color: '#F59E0B', icon: 'calendar-outline' },
  loan: { color: '#8B5CF6', icon: 'swap-horizontal-outline' },
};

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

interface Props {
  entries: CalendarEntry[];
  selectedDate: string;
}

export function CalendarDayBookings({ entries, selectedDate }: Props) {
  if (entries.length === 0) {
    return (
      <View className="flex-1 items-center justify-center p-6">
        <Ionicons name="calendar-outline" size={48} color="#78716C" />
        <Text className="text-lg font-semibold text-foreground mt-4 mb-2">No bookings</Text>
        <Text className="text-sm text-muted-foreground text-center">
          Nothing scheduled for this day.
        </Text>
      </View>
    );
  }

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <View className="flex-1">
      <View className="px-4 py-3 border-b border-border">
        <Text className="text-sm font-semibold text-foreground">{dateLabel}</Text>
        <Text className="text-xs text-muted-foreground">{entries.length} booking{entries.length !== 1 ? 's' : ''}</Text>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item, idx) => `${item.booking_id}-${idx}`}
        renderItem={({ item }) => <CalendarBookingRow entry={item} />}
        contentContainerStyle={{ padding: 12, gap: 8 }}
      />
    </View>
  );
}

function CalendarBookingRow({ entry }: { entry: CalendarEntry }) {
  const catConfig = CATEGORY_CONFIG[entry.category] || CATEGORY_CONFIG.product;
  const statusColor = STATUS_COLORS[entry.status] ?? '#6B7280';
  const statusLabel = STATUS_LABELS[entry.status] ?? entry.status;
  const isCancelled = entry.status === 'cancelled';

  // Subtitle: role + other party
  const roleLabel = entry.role === 'provider' ? 'from' : 'with';
  const subtitle = `${roleLabel} ${entry.other_party_name}`;

  // Loan context
  const loanContext = entry.is_loan && entry.loan_due_date && !entry.loan_returned_at
    ? (() => {
        const days = Math.ceil((new Date(entry.loan_due_date).getTime() - Date.now()) / 86400000);
        if (days < 0) return `Overdue ${Math.abs(days)}d`;
        if (days === 0) return 'Due today';
        if (days === 1) return 'Due tomorrow';
        return `Due in ${days}d`;
      })()
    : entry.loan_returned_at ? 'Returned' : null;

  return (
    <Pressable
      className={`flex-row items-center p-3 rounded-xl bg-card border border-border ${isCancelled ? 'opacity-50' : ''}`}
      onPress={() => router.push({ pathname: '/booking/[bookingId]', params: { bookingId: entry.booking_id } })}
    >
      {/* Category icon */}
      <View
        className="w-10 h-10 rounded-lg items-center justify-center mr-3"
        style={{ backgroundColor: catConfig.color + '15' }}
      >
        <Ionicons name={catConfig.icon} size={20} color={catConfig.color} />
      </View>

      {/* Content */}
      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          {entry.time && (
            <Text className="text-sm font-bold text-foreground">{entry.time}</Text>
          )}
          <Text className={`text-sm font-semibold ${isCancelled ? 'line-through text-muted-foreground' : 'text-foreground'}`} numberOfLines={1}>
            {entry.title}
          </Text>
        </View>

        <Text className="text-xs text-muted-foreground" numberOfLines={1}>
          {subtitle}
        </Text>

        {loanContext && (
          <Text className="text-xs font-medium" style={{ color: loanContext.startsWith('Overdue') ? '#DC2626' : '#8B5CF6' }}>
            {loanContext}
          </Text>
        )}
      </View>

      {/* Status dot + label */}
      <View className="flex-row items-center gap-1.5 ml-2">
        <View className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
        <Text className="text-xs font-medium" style={{ color: statusColor }}>
          {statusLabel}
        </Text>
      </View>
    </Pressable>
  );
}
