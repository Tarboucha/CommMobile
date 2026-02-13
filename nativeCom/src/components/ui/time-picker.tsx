import React, { useState, useEffect, useCallback } from 'react';
import { View, Modal, Pressable, StyleSheet } from 'react-native';
import WheelPicker from '@quidone/react-native-wheel-picker';
import { Text } from '@/components/ui/text';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';

interface TimePickerProps {
  visible: boolean;
  value: string; // "HH:MM" format
  onChange: (time: string) => void;
  onClose: () => void;
  title?: string;
}

// Generate hours 00-23 (value as number for WheelPicker)
const HOURS_DATA = [...Array(24).keys()].map((index) => ({
  value: index,
  label: index.toString().padStart(2, '0'),
}));

// Generate minutes 00-55 in 5-minute intervals
const MINUTES_DATA = [...Array(12).keys()].map((index) => ({
  value: index * 5,
  label: (index * 5).toString().padStart(2, '0'),
}));

// Round minute to nearest 5
const roundToNearest5 = (minute: number): number => {
  return Math.round(minute / 5) * 5 % 60;
};

// Format number to 2-digit string
const pad = (n: number): string => n.toString().padStart(2, '0');

export function TimePicker({
  visible,
  value,
  onChange,
  onClose,
  title = 'Select Time',
}: TimePickerProps) {
  const { colorScheme } = useTheme();
  const isDark = colorScheme === 'dark';

  // Parse initial value
  const parseTime = useCallback((timeStr: string) => {
    const parts = timeStr.split(':');
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    return {
      hour: isNaN(h) ? 11 : h,
      minute: roundToNearest5(isNaN(m) ? 0 : m),
    };
  }, []);

  // Local state for the wheel pickers
  const [selectedHour, setSelectedHour] = useState(0);
  const [selectedMinute, setSelectedMinute] = useState(0);

  // Sync with external value when modal opens
  useEffect(() => {
    if (visible) {
      const { hour, minute } = parseTime(value);
      setSelectedHour(hour);
      setSelectedMinute(minute);
    }
  }, [visible, value, parseTime]);

  const handleConfirm = useCallback(() => {
    onChange(`${pad(selectedHour)}:${pad(selectedMinute)}`);
    onClose();
  }, [selectedHour, selectedMinute, onChange, onClose]);

  const textColor = isDark ? '#FFFFFF' : '#1F2937';
  const mutedColor = isDark ? '#6B7280' : '#9CA3AF';
  const primaryColor = '#660000';
  const bgColor = isDark ? '#1F2937' : '#FFFFFF';
  const overlayBg = isDark ? 'rgba(102, 0, 0, 0.15)' : 'rgba(102, 0, 0, 0.1)';

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPressable} onPress={onClose} />

        <View style={[styles.container, { backgroundColor: bgColor }]}>
          {/* Header */}
          <View style={styles.header}>
            <Text className="text-lg font-bold text-foreground">{title}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={mutedColor} />
            </Pressable>
          </View>

          {/* Time Display */}
          <View style={styles.timeDisplay}>
            <Text style={[styles.timeText, { color: primaryColor }]}>
              {pad(selectedHour)}:{pad(selectedMinute)}
            </Text>
          </View>

          {/* Wheel Pickers */}
          <View style={styles.pickersContainer}>
            {/* Hours Wheel */}
            <View style={styles.pickerWrapper}>
              <Text style={[styles.pickerLabel, { color: mutedColor }]}>
                Hours
              </Text>
              <WheelPicker
                data={HOURS_DATA}
                value={selectedHour}
                onValueChanged={({ item: { value: v } }) => setSelectedHour(v)}
                itemHeight={44}
                visibleItemCount={5}
                width={80}
                itemTextStyle={{
                  fontSize: 22,
                  fontWeight: '600',
                  color: textColor,
                }}
                overlayItemStyle={{
                  backgroundColor: overlayBg,
                  borderRadius: 12,
                }}
              />
            </View>

            {/* Separator */}
            <View style={styles.separator}>
              <Text style={[styles.separatorText, { color: primaryColor }]}>:</Text>
            </View>

            {/* Minutes Wheel */}
            <View style={styles.pickerWrapper}>
              <Text style={[styles.pickerLabel, { color: mutedColor }]}>
                Minutes
              </Text>
              <WheelPicker
                data={MINUTES_DATA}
                value={selectedMinute}
                onValueChanged={({ item: { value: v } }) => setSelectedMinute(v)}
                itemHeight={44}
                visibleItemCount={5}
                width={80}
                itemTextStyle={{
                  fontSize: 22,
                  fontWeight: '600',
                  color: textColor,
                }}
                overlayItemStyle={{
                  backgroundColor: overlayBg,
                  borderRadius: 12,
                }}
              />
            </View>
          </View>

          {/* Confirm Button */}
          <View style={styles.buttonContainer}>
            <Pressable
              style={[styles.confirmButton, { backgroundColor: primaryColor }]}
              onPress={handleConfirm}
            >
              <Text style={styles.confirmButtonText}>Confirm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  backdropPressable: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    width: '85%',
    maxWidth: 340,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  timeDisplay: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  timeText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  pickersContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  pickerWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  separator: {
    paddingHorizontal: 8,
    paddingTop: 24,
  },
  separatorText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  buttonContainer: {
    padding: 16,
  },
  confirmButton: {
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
