import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { SlotCardPicker } from './slot-card-picker';
import type { DaySlots, CalendarSlot } from '@/types/availability';

export interface DaySlotsPickerProps {
  /** The selected date string (YYYY-MM-DD) */
  selectedDate: string;
  /** Day slots data or null if no slots */
  dayData: DaySlots | null;
  /** Currently selected slot ID */
  selectedSlotId: string | null;
  /** Called when user selects a slot */
  onSlotSelect: (slot: CalendarSlot) => void;
  /** Optional: Hide date header */
  hideDateHeader?: boolean;
  /** Optional: Custom empty state message */
  emptyMessage?: string;
}

/**
 * DaySlotsPicker Component
 *
 * Renders a list of selectable time slots for a given day.
 * Used in the customer-facing schedule picker flow.
 */
export function DaySlotsPicker({
  selectedDate,
  dayData,
  selectedSlotId,
  onSlotSelect,
  hideDateHeader = false,
  emptyMessage = 'No pickup times available for this day.',
}: DaySlotsPickerProps) {
  // Format date for display
  const formatDateDisplay = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  // Filter to only show active (non-cancelled) slots
  const slots = (dayData?.slots || []).filter((s) => !s.is_cancelled);
  const hasSlots = slots.length > 0;

  // Calculate availability summary
  const totalAvailable = slots.reduce(
    (sum, s) => sum + Math.max(0, s.quantity_available - s.quantity_sold),
    0
  );
  const allSoldOut = hasSlots && totalAvailable === 0;

  return (
    <View className="flex-1 px-4">
      {/* Date Header */}
      {!hideDateHeader && (
        <View className="mb-4">
          <Text className="text-lg font-bold text-foreground">
            {formatDateDisplay(selectedDate)}
          </Text>

          {/* Availability Summary */}
          {hasSlots && (
            <View className="flex-row items-center gap-2 mt-2">
              {allSoldOut ? (
                <View className="flex-row items-center gap-1">
                  <View className="w-2 h-2 rounded-full bg-red-500" />
                  <Text className="text-xs text-muted-foreground">All sold out</Text>
                </View>
              ) : (
                <>
                  <View className="flex-row items-center gap-1">
                    <View className="w-2 h-2 rounded-full bg-emerald-500" />
                    <Text className="text-xs text-muted-foreground">
                      {totalAvailable} spot{totalAvailable !== 1 ? 's' : ''} available
                    </Text>
                  </View>
                  <Text className="text-xs text-muted-foreground">•</Text>
                  <Text className="text-xs text-muted-foreground">
                    {slots.length} time slot{slots.length !== 1 ? 's' : ''}
                  </Text>
                </>
              )}
            </View>
          )}
        </View>
      )}

      {/* Divider */}
      {!hideDateHeader && <View className="h-px bg-border mb-4" />}

      {/* Slots List */}
      {hasSlots ? (
        <View>
          {slots.map((slot) => (
            <SlotCardPicker
              key={`${slot.schedule_id}_${slot.date}`}
              slot={slot}
              isSelected={selectedSlotId === slot.schedule_id}
              onPress={() => onSlotSelect(slot)}
            />
          ))}
        </View>
      ) : (
        /* Empty State */
        <View className="flex-1 items-center justify-center py-12">
          <View className="w-16 h-16 rounded-full bg-muted items-center justify-center mb-4">
            <Ionicons name="time-outline" size={32} color="#6B7280" />
          </View>
          <Text className="text-base font-semibold text-foreground mb-1">
            No Available Times
          </Text>
          <Text className="text-sm text-muted-foreground text-center max-w-[250px]">
            {emptyMessage}
          </Text>
        </View>
      )}
    </View>
  );
}
