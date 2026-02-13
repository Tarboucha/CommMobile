import { useState } from 'react';
import { View, Pressable, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme } from 'react-native';

interface DateTimePickerFieldProps {
  label: string;
  value: string | null; // ISO String
  onChange: (value: string | null) => void;
  mode?: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * DateTimePicker Field Component
 * Wrapper around @react-native-community/datetimepicker
 * Displays date/time with a native picker
 */
export function DateTimePickerField({
  label,
  value,
  onChange,
  mode = 'datetime',
  minimumDate,
  disabled = false,
  placeholder = 'Select date & time',
}: DateTimePickerFieldProps) {
  const colorScheme = useColorScheme();

  const [show, setShow] = useState(false);
  const [tempDate, setTempDate] = useState<Date | null>(value ? new Date(value) : null);

  // Handle date change (iOS and Android differ)
  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
    }

    if (event.type === 'set' && selectedDate) {
      setTempDate(selectedDate);
      onChange(selectedDate.toISOString());
    } else if (event.type === 'dismissed') {
      setShow(false);
    }
  };

  // Format display value
  const formatDisplayValue = () => {
    if (!value) return null;

    const date = new Date(value);

    if (mode === 'date') {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    } else if (mode === 'time') {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
    } else {
      // datetime
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  // Handle clear
  const handleClear = () => {
    setTempDate(null);
    onChange(null);
  };

  // Show picker
  const handlePress = () => {
    if (disabled) return;
    setShow(true);
  };

  const displayValue = formatDisplayValue();

  return (
    <View className="mb-4">
      {/* Label */}
      <Text className="text-base font-medium mb-1">{label}</Text>

      {/* Picker Button */}
      <Pressable
        className={cn(
          'flex-row items-center justify-between border border-border rounded-lg p-4 bg-background',
          disabled && 'opacity-60'
        )}
        onPress={handlePress}
        disabled={disabled}
      >
        <View className="flex-row items-center gap-2 flex-1">
          <Ionicons
            name={mode === 'time' ? 'time-outline' : 'calendar-outline'}
            size={20}
            color={displayValue ? '#1F2937' : '#6B7280'}
          />
          <Text
            className={cn(
              'text-base',
              displayValue ? '' : 'text-muted-foreground'
            )}
          >
            {displayValue || placeholder}
          </Text>
        </View>

        {/* Clear Button */}
        {displayValue && !disabled && (
          <Pressable onPress={handleClear} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color="#6B7280" />
          </Pressable>
        )}
      </Pressable>

      {/* DateTimePicker */}
      {show && (
        <DateTimePicker
          value={tempDate || new Date()}
          mode={mode}
          is24Hour={false}
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          themeVariant={colorScheme ?? 'light'}
        />
      )}
    </View>
  );
}
