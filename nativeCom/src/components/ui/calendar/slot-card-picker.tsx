import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { CalendarSlot } from '@/types/availability';

export interface SlotCardPickerProps {
  /** Slot data */
  slot: CalendarSlot;
  /** Whether this slot is currently selected */
  isSelected: boolean;
  /** Called when user taps the card */
  onPress: () => void;
}

/**
 * SlotCardPicker Component
 *
 * Selectable slot card for customer to pick a time.
 * Shows slot label, time, availability, and selection indicator.
 */
export function SlotCardPicker({ slot, isSelected, onPress }: SlotCardPickerProps) {
  const remaining = slot.quantity_available - slot.quantity_sold;
  const isLowStock = remaining > 0 && remaining <= 5;
  const isSoldOut = remaining <= 0;

  return (
    <Pressable
      onPress={onPress}
      disabled={isSoldOut}
      className={cn(
        'flex-row items-center justify-between px-4 py-4 rounded-xl border mb-3',
        isSelected ? 'bg-primary/10 border-primary' : 'bg-card border-border',
        isSoldOut && 'opacity-50'
      )}
    >
      <View className="flex-1">
        {/* Slot Label */}
        {slot.slot_label && (
          <Text className="text-sm font-semibold text-foreground mb-1">{slot.slot_label}</Text>
        )}

        {/* Time */}
        <View className="flex-row items-center gap-2">
          <Ionicons name="time-outline" size={16} color="#6B7280" />
          <Text className="text-base text-foreground">
            {slot.start_time} - {slot.end_time}
          </Text>
        </View>

        {/* Exception indicator */}
        {slot.has_exception && !slot.is_cancelled && (
          <View className="flex-row items-center gap-1 mt-1">
            <Ionicons name="information-circle-outline" size={14} color="#F59E0B" />
            <Text className="text-xs text-amber-600">Modified schedule</Text>
          </View>
        )}
      </View>

      {/* Quantity Badge */}
      <View
        className={cn(
          'px-3 py-1.5 rounded-full mr-3',
          isSoldOut
            ? 'bg-red-500/20'
            : isLowStock
              ? 'bg-amber-500/20'
              : 'bg-emerald-500/20'
        )}
      >
        <Text
          className={cn(
            'text-xs font-semibold',
            isSoldOut
              ? 'text-red-600'
              : isLowStock
                ? 'text-amber-600'
                : 'text-emerald-600'
          )}
        >
          {isSoldOut
            ? 'Sold out'
            : isLowStock
              ? `Only ${remaining} left!`
              : `${remaining} available`}
        </Text>
      </View>

      {/* Selection Indicator */}
      <View
        className={cn(
          'w-6 h-6 rounded-full border-2 items-center justify-center',
          isSelected ? 'bg-primary border-primary' : 'border-border'
        )}
      >
        {isSelected && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
      </View>
    </Pressable>
  );
}
