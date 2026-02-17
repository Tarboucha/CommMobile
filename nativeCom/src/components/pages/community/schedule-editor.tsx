import { useState } from 'react';
import {
  View,
  Modal,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { createOfferingSchedule } from '@/lib/api/offerings';

const WEEKDAYS = [
  { value: 'MO', label: 'Mon' },
  { value: 'TU', label: 'Tue' },
  { value: 'WE', label: 'Wed' },
  { value: 'TH', label: 'Thu' },
  { value: 'FR', label: 'Fri' },
  { value: 'SA', label: 'Sat' },
  { value: 'SU', label: 'Sun' },
];

function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

export function ScheduleEditor({
  offeringId,
  visible,
  onClose,
  onSaved,
}: {
  offeringId: string;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [dtstart, setDtstart] = useState(getTodayDate());
  const [dtend, setDtend] = useState('');
  const [slotsAvailable, setSlotsAvailable] = useState('10');
  const [slotLabel, setSlotLabel] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleDay = (day: string) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSubmit = async () => {
    if (selectedDays.length === 0) {
      Alert.alert('Validation', 'Select at least one day');
      return;
    }
    if (!startTime || !endTime) {
      Alert.alert('Validation', 'Start and end time are required');
      return;
    }
    if (endTime <= startTime) {
      Alert.alert('Validation', 'End time must be after start time');
      return;
    }
    if (!slotsAvailable || parseInt(slotsAvailable) < 1) {
      Alert.alert('Validation', 'At least 1 slot is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const rrule = `FREQ=WEEKLY;BYDAY=${selectedDays.join(',')}`;

      await createOfferingSchedule(offeringId, {
        rrule,
        dtstart,
        dtend: dtend || null,
        start_time: startTime,
        end_time: endTime,
        slots_available: parseInt(slotsAvailable),
        slot_label: slotLabel || undefined,
        is_active: true,
      });

      onSaved();
      onClose();
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create schedule');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-4 border-b border-border">
          <Pressable onPress={onClose}>
            <Text className="text-sm text-muted-foreground">Cancel</Text>
          </Pressable>
          <Text className="text-base font-semibold text-foreground">Add Schedule</Text>
          <Pressable onPress={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="text-sm font-semibold text-primary">Save</Text>
            )}
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Days */}
          <View className="gap-2 mb-6">
            <Text className="text-sm font-medium text-foreground">Days *</Text>
            <View className="flex-row gap-1.5">
              {WEEKDAYS.map((day) => (
                <Pressable
                  key={day.value}
                  className={`flex-1 py-2.5 rounded-lg items-center ${
                    selectedDays.includes(day.value)
                      ? 'bg-primary'
                      : 'bg-card border border-border'
                  }`}
                  onPress={() => toggleDay(day.value)}
                >
                  <Text
                    className={`text-xs font-medium ${
                      selectedDays.includes(day.value)
                        ? 'text-primary-foreground'
                        : 'text-foreground'
                    }`}
                  >
                    {day.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* Time Range */}
          <View className="gap-2 mb-6">
            <Text className="text-sm font-medium text-foreground">Time Range *</Text>
            <View className="flex-row gap-3 items-center">
              <TextInput
                className="flex-1 border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card text-center"
                placeholder="09:00"
                placeholderTextColor="#78716C"
                value={startTime}
                onChangeText={setStartTime}
                maxLength={5}
              />
              <Text className="text-sm text-muted-foreground">to</Text>
              <TextInput
                className="flex-1 border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card text-center"
                placeholder="17:00"
                placeholderTextColor="#78716C"
                value={endTime}
                onChangeText={setEndTime}
                maxLength={5}
              />
            </View>
          </View>

          {/* Date Range */}
          <View className="gap-2 mb-6">
            <Text className="text-sm font-medium text-foreground">Date Range</Text>
            <View className="flex-row gap-3 items-center">
              <View className="flex-1 gap-1">
                <Text className="text-xs text-muted-foreground">Start</Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#78716C"
                  value={dtstart}
                  onChangeText={setDtstart}
                  maxLength={10}
                />
              </View>
              <View className="flex-1 gap-1">
                <Text className="text-xs text-muted-foreground">End (optional)</Text>
                <TextInput
                  className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card"
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#78716C"
                  value={dtend}
                  onChangeText={setDtend}
                  maxLength={10}
                />
              </View>
            </View>
          </View>

          {/* Slots */}
          <View className="gap-2 mb-6">
            <Text className="text-sm font-medium text-foreground">Slots Available *</Text>
            <TextInput
              className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card"
              placeholder="10"
              placeholderTextColor="#78716C"
              value={slotsAvailable}
              onChangeText={setSlotsAvailable}
              keyboardType="number-pad"
            />
          </View>

          {/* Slot Label */}
          <View className="gap-2 mb-6">
            <Text className="text-sm font-medium text-foreground">Slot Label (optional)</Text>
            <TextInput
              className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card"
              placeholder="e.g. seats, servings, spots"
              placeholderTextColor="#78716C"
              value={slotLabel}
              onChangeText={setSlotLabel}
              maxLength={100}
            />
          </View>

          {/* Info */}
          <View className="flex-row p-4 rounded-lg border border-border gap-2 bg-muted">
            <Ionicons name="information-circle-outline" size={20} color="#660000" />
            <View className="flex-1">
              <Text className="text-xs leading-5 text-foreground">
                This creates a weekly recurring schedule. Customers will be able to book
                during these time slots on the selected days.
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
