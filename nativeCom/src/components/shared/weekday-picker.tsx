import { View, Pressable } from "react-native";
import { Text } from "@/components/ui/text";
import { Ionicons } from "@expo/vector-icons";
import {
  RRULE_WEEKDAYS,
  type RRuleWeekday,
} from "@/types/availability";

interface WeekdayPickerProps {
  value: RRuleWeekday[]; // Array of weekday codes
  onChange: (value: RRuleWeekday[]) => void;
  disabled?: boolean;
  label?: string;
}

// Short day labels for compact display
const DAY_SHORT: Record<RRuleWeekday, string> = {
  MO: "Mon",
  TU: "Tue",
  WE: "Wed",
  TH: "Thu",
  FR: "Fri",
  SA: "Sat",
  SU: "Sun",
};

/**
 * Weekday Picker Component
 * Modern, touch-friendly design with larger targets and better visual feedback
 */
export function WeekdayPicker({
  value,
  onChange,
  disabled = false,
  label,
}: WeekdayPickerProps) {
  const toggleDay = (day: RRuleWeekday) => {
    if (disabled) return;

    const isSelected = value.includes(day);
    let newDays: RRuleWeekday[];

    if (isSelected) {
      // Remove day (but ensure at least one day remains)
      newDays = value.filter((d) => d !== day);
      if (newDays.length === 0) return; // Don't allow empty selection
    } else {
      // Add day
      newDays = [...value, day];
    }

    onChange(newDays);
  };

  const selectAllWeekdays = () => {
    if (disabled) return;
    onChange(["MO", "TU", "WE", "TH", "FR"]);
  };

  const selectWeekend = () => {
    if (disabled) return;
    onChange(["SA", "SU"]);
  };

  const selectAll = () => {
    if (disabled) return;
    onChange([...RRULE_WEEKDAYS]);
  };

  const isWeekdaysSelected =
    value.length === 5 &&
    ["MO", "TU", "WE", "TH", "FR"].every((d) => value.includes(d as RRuleWeekday)) &&
    !value.includes("SA") &&
    !value.includes("SU");

  const isWeekendSelected =
    value.length === 2 &&
    value.includes("SA") &&
    value.includes("SU");

  const isAllSelected = value.length === 7;

  return (
    <View className="mb-6">
      {label && (
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-base font-semibold">
            {label}
          </Text>
          <Text className="text-xs text-muted-foreground">
            {value.length} selected
          </Text>
        </View>
      )}

      {/* Day Buttons - Circular design */}
      <View className="flex-row justify-between gap-1">
        {RRULE_WEEKDAYS.map((day) => {
          const isSelected = value.includes(day);

          return (
            <Pressable
              key={day}
              className={`flex-1 aspect-square max-w-[48px] min-h-[48px] rounded-xl border-2 items-center justify-center py-1 ${isSelected ? 'bg-primary border-primary' : 'bg-muted border-border'} ${disabled ? 'opacity-50' : ''}`}
              style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.92 : 1 }] })}
              onPress={() => toggleDay(day)}
              disabled={disabled}
            >
              <Text
                className={`text-[11px] font-semibold ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}
              >
                {DAY_SHORT[day]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Quick Select Presets - Chip style */}
      <View className="mt-4">
        <Text className="text-xs mb-1 text-muted-foreground">
          Quick select:
        </Text>
        <View className="flex-row flex-wrap gap-3">
          <Pressable
            className={`flex-row items-center py-3 px-4 rounded-full border-[1.5px] gap-1 ${isWeekdaysSelected ? 'bg-primary border-primary' : 'bg-muted border-border'}`}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}
            onPress={selectAllWeekdays}
            disabled={disabled}
          >
            <Ionicons
              name="briefcase-outline"
              size={14}
              color={isWeekdaysSelected ? '#FFFFFF' : '#1F2937'}
            />
            <Text
              className={`text-xs font-semibold ${isWeekdaysSelected ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              Weekdays
            </Text>
          </Pressable>

          <Pressable
            className={`flex-row items-center py-3 px-4 rounded-full border-[1.5px] gap-1 ${isWeekendSelected ? 'bg-primary border-primary' : 'bg-muted border-border'}`}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}
            onPress={selectWeekend}
            disabled={disabled}
          >
            <Ionicons
              name="sunny-outline"
              size={14}
              color={isWeekendSelected ? '#FFFFFF' : '#1F2937'}
            />
            <Text
              className={`text-xs font-semibold ${isWeekendSelected ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              Weekend
            </Text>
          </Pressable>

          <Pressable
            className={`flex-row items-center py-3 px-4 rounded-full border-[1.5px] gap-1 ${isAllSelected ? 'bg-primary border-primary' : 'bg-muted border-border'}`}
            style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.95 : 1 }] })}
            onPress={selectAll}
            disabled={disabled}
          >
            <Ionicons
              name="calendar-outline"
              size={14}
              color={isAllSelected ? '#FFFFFF' : '#1F2937'}
            />
            <Text
              className={`text-xs font-semibold ${isAllSelected ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              Every day
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
