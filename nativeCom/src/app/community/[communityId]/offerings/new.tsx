import { useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { TimePicker } from '@/components/ui/time-picker';
import { DateTimePickerField } from '@/components/shared/date-time-picker-field';
import { createOffering, createOfferingSchedule } from '@/lib/api/offerings';
import {
  OFFERING_CATEGORIES,
  PRICE_TYPES,
  FULFILLMENT_METHODS,
  RRULE_WEEKDAYS,
  WEEKDAY_LABELS,
  buildWeeklyRRule,
} from '@/types/offering';
import type {
  OfferingCategory,
  PriceType,
  FulfillmentMethod,
  CreateOfferingInput,
  RRuleWeekday,
} from '@/types/offering';

// ── Shared sub-components ──────────────────────────────────────────────────

function OptionPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            className={`px-4 py-2 rounded-lg border ${
              value === opt.value
                ? 'bg-primary border-primary'
                : 'bg-card border-border'
            }`}
            onPress={() => onChange(opt.value)}
          >
            <Text
              className={`text-sm ${
                value === opt.value
                  ? 'text-primary-foreground font-semibold'
                  : 'text-foreground'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function TimeField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <View className="gap-1 flex-1">
        <Text className="text-xs text-muted-foreground">{label}</Text>
        <Pressable
          className="border border-border rounded-lg px-4 py-3 bg-muted flex-row items-center justify-center gap-2"
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="time-outline" size={16} color="#78716C" />
          <Text className="text-sm font-semibold text-foreground">{value}</Text>
        </Pressable>
      </View>
      <TimePicker
        visible={showPicker}
        value={value}
        onChange={onChange}
        onClose={() => setShowPicker(false)}
        title={`Select ${label}`}
      />
    </>
  );
}

function CapacityInputs({
  slotsAvailable,
  slotLabel,
  onSlotsChange,
  onLabelChange,
}: {
  slotsAvailable: string;
  slotLabel: string;
  onSlotsChange: (v: string) => void;
  onLabelChange: (v: string) => void;
}) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-xs text-muted-foreground">Slots Available *</Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            className="w-10 h-10 rounded-lg border border-border bg-muted justify-center items-center"
            onPress={() => {
              const v = parseInt(slotsAvailable) || 0;
              if (v > 1) onSlotsChange(String(v - 1));
            }}
          >
            <Ionicons name="remove" size={18} color="#78716C" />
          </Pressable>
          <TextInput
            className="flex-1 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground bg-muted text-center font-semibold"
            value={slotsAvailable}
            onChangeText={onSlotsChange}
            keyboardType="number-pad"
          />
          <Pressable
            className="w-10 h-10 rounded-lg border border-border bg-muted justify-center items-center"
            onPress={() => {
              const v = parseInt(slotsAvailable) || 0;
              onSlotsChange(String(v + 1));
            }}
          >
            <Ionicons name="add" size={18} color="#78716C" />
          </Pressable>
        </View>
      </View>

      <View className="gap-1">
        <Text className="text-xs text-muted-foreground">Slot Label (optional)</Text>
        <TextInput
          className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-muted"
          placeholder="e.g. seats, servings, spots"
          placeholderTextColor="#78716C"
          value={slotLabel}
          onChangeText={onLabelChange}
          maxLength={100}
        />
      </View>
    </View>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

type ScheduleMode = 'one-time' | 'recurring';

function getTodayISO(): string {
  return new Date().toISOString();
}

function isoToDateStr(iso: string): string {
  return iso.split('T')[0];
}

/** Map a YYYY-MM-DD date string to the RRULE weekday code for that date. */
function dateToWeekday(dateStr: string): RRuleWeekday {
  const dayIndex = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun
  const map: RRuleWeekday[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  return map[dayIndex];
}

function formatDateDisplay(iso: string | null): string {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ── Main screen ─────────────────────────────────────────────────────────────

export default function NewOfferingScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Offering form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<OfferingCategory>('product');
  const [priceType, setPriceType] = useState<PriceType>('fixed');
  const [priceAmount, setPriceAmount] = useState('');
  const [fulfillmentMethod, setFulfillmentMethod] = useState<FulfillmentMethod>('pickup');

  // Schedule toggle + mode
  const [includeSchedule, setIncludeSchedule] = useState(false);
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('one-time');

  // One-time fields
  const [oneTimeDate, setOneTimeDate] = useState<string | null>(getTodayISO());
  const [oneTimeStartTime, setOneTimeStartTime] = useState('09:00');
  const [oneTimeEndTime, setOneTimeEndTime] = useState('17:00');
  const [oneTimeSlots, setOneTimeSlots] = useState('10');
  const [oneTimeSlotLabel, setOneTimeSlotLabel] = useState('');

  // Recurring fields
  const [selectedDays, setSelectedDays] = useState<RRuleWeekday[]>(['MO', 'TU', 'WE', 'TH', 'FR']);
  const [recurStartTime, setRecurStartTime] = useState('09:00');
  const [recurEndTime, setRecurEndTime] = useState('17:00');
  const [dtstart, setDtstart] = useState<string | null>(getTodayISO());
  const [dtend, setDtend] = useState<string | null>(null);
  const [recurSlots, setRecurSlots] = useState('10');
  const [recurSlotLabel, setRecurSlotLabel] = useState('');

  // Day helpers
  const toggleDay = (day: RRuleWeekday) => {
    setSelectedDays((prev) => {
      if (prev.includes(day)) {
        const next = prev.filter((d) => d !== day);
        return next.length === 0 ? prev : next;
      }
      return [...prev, day];
    });
  };

  const selectPreset = (preset: 'weekdays' | 'weekend' | 'all') => {
    if (preset === 'weekdays') setSelectedDays(['MO', 'TU', 'WE', 'TH', 'FR']);
    else if (preset === 'weekend') setSelectedDays(['SA', 'SU']);
    else setSelectedDays([...RRULE_WEEKDAYS]);
  };

  const isWeekdaysPreset =
    selectedDays.length === 5 &&
    ['MO', 'TU', 'WE', 'TH', 'FR'].every((d) => selectedDays.includes(d as RRuleWeekday)) &&
    !selectedDays.includes('SA') && !selectedDays.includes('SU');
  const isWeekendPreset =
    selectedDays.length === 2 && selectedDays.includes('SA') && selectedDays.includes('SU');
  const isAllPreset = selectedDays.length === 7;

  // ── Validation & submit ───────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert('Validation', 'Title is required');
      return;
    }

    if (priceType === 'fixed' && (!priceAmount || parseFloat(priceAmount) <= 0)) {
      Alert.alert('Validation', 'Price amount is required for fixed pricing');
      return;
    }

    // Schedule validation
    if (includeSchedule) {
      const st = scheduleMode === 'one-time' ? oneTimeStartTime : recurStartTime;
      const et = scheduleMode === 'one-time' ? oneTimeEndTime : recurEndTime;
      const slots = scheduleMode === 'one-time' ? oneTimeSlots : recurSlots;

      if (!st || !et) {
        Alert.alert('Validation', 'Start and end time are required');
        return;
      }
      if (et <= st) {
        Alert.alert('Validation', 'End time must be after start time');
        return;
      }
      if (!slots || parseInt(slots) < 1) {
        Alert.alert('Validation', 'At least 1 slot is required');
        return;
      }

      if (scheduleMode === 'one-time' && !oneTimeDate) {
        Alert.alert('Validation', 'Date is required for a one-time offering');
        return;
      }
      if (scheduleMode === 'recurring' && !dtstart) {
        Alert.alert('Validation', 'Start date is required for a recurring schedule');
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const input: CreateOfferingInput = {
        title: title.trim(),
        category,
        price_type: priceType,
        fulfillment_method: fulfillmentMethod,
      };

      if (description.trim()) input.description = description.trim();
      if (priceType === 'fixed' || priceType === 'negotiable') {
        input.price_amount = parseFloat(priceAmount);
      }

      const offering = await createOffering(communityId!, input);

      // Create schedule
      if (includeSchedule) {
        if (scheduleMode === 'one-time') {
          const dateStr = isoToDateStr(oneTimeDate!);
          const dayCode = dateToWeekday(dateStr);
          await createOfferingSchedule(offering.id, {
            rrule: buildWeeklyRRule([dayCode]),
            dtstart: dateStr,
            dtend: dateStr, // Same date = single occurrence
            start_time: oneTimeStartTime,
            end_time: oneTimeEndTime,
            slots_available: parseInt(oneTimeSlots),
            slot_label: oneTimeSlotLabel.trim() || undefined,
            is_active: true,
          });
        } else {
          await createOfferingSchedule(offering.id, {
            rrule: buildWeeklyRRule(selectedDays),
            dtstart: isoToDateStr(dtstart!),
            dtend: dtend ? isoToDateStr(dtend) : null,
            start_time: recurStartTime,
            end_time: recurEndTime,
            slots_available: parseInt(recurSlots),
            slot_label: recurSlotLabel.trim() || undefined,
            is_active: true,
          });
        }
      }

      Alert.alert('Success', 'Offering created!', [
        {
          text: 'View Offering',
          onPress: () => {
            router.replace({
              pathname: '/community/[communityId]/offerings/[offeringId]',
              params: { communityId: communityId!, offeringId: offering.id },
            });
          },
        },
        { text: 'Done', onPress: () => router.back() },
      ]);
    } catch (err) {
      Alert.alert('Error', err instanceof Error ? err.message : 'Failed to create offering');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'New Offering' }} />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Basic Info ── */}
        <View className="gap-4 mb-6">
          <Text className="text-lg font-bold text-foreground">Basic Info</Text>

          <View className="gap-1">
            <Text className="text-sm font-medium text-foreground">Title *</Text>
            <TextInput
              className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card"
              placeholder="What are you offering?"
              placeholderTextColor="#78716C"
              value={title}
              onChangeText={setTitle}
              maxLength={200}
            />
          </View>

          <View className="gap-1">
            <Text className="text-sm font-medium text-foreground">Description</Text>
            <TextInput
              className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card min-h-[100px]"
              placeholder="Describe your offering..."
              placeholderTextColor="#78716C"
              value={description}
              onChangeText={setDescription}
              multiline
              textAlignVertical="top"
              maxLength={2000}
            />
          </View>
        </View>

        {/* ── Category ── */}
        <View className="mb-6">
          <OptionPicker
            label="Category *"
            options={OFFERING_CATEGORIES}
            value={category}
            onChange={setCategory}
          />
        </View>

        {/* ── Pricing ── */}
        <View className="gap-4 mb-6">
          <Text className="text-lg font-bold text-foreground">Pricing</Text>

          <OptionPicker
            label="Price Type"
            options={PRICE_TYPES}
            value={priceType}
            onChange={setPriceType}
          />

          {(priceType === 'fixed' || priceType === 'negotiable') && (
            <View className="gap-1">
              <Text className="text-sm font-medium text-foreground">
                Price (EUR) {priceType === 'fixed' ? '*' : ''}
              </Text>
              <TextInput
                className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card"
                placeholder="0.00"
                placeholderTextColor="#78716C"
                value={priceAmount}
                onChangeText={setPriceAmount}
                keyboardType="decimal-pad"
              />
            </View>
          )}
        </View>

        {/* ── Fulfillment ── */}
        <View className="mb-6">
          <OptionPicker
            label="Fulfillment Method"
            options={FULFILLMENT_METHODS}
            value={fulfillmentMethod}
            onChange={setFulfillmentMethod}
          />
        </View>

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* AVAILABILITY SCHEDULE                                             */}
        {/* ══════════════════════════════════════════════════════════════════ */}

        <View className="flex-row items-center justify-between p-4 rounded-xl border border-border bg-card mb-4">
          <View className="flex-row items-center gap-3">
            <View className="w-9 h-9 rounded-lg bg-primary/15 justify-center items-center">
              <Ionicons name="calendar-outline" size={18} color="#660000" />
            </View>
            <View>
              <Text className="text-sm font-semibold text-foreground">Availability Schedule</Text>
              <Text className="text-xs text-muted-foreground">Set when this offering is available</Text>
            </View>
          </View>
          <Switch
            value={includeSchedule}
            onValueChange={setIncludeSchedule}
            trackColor={{ false: '#D6D3D1', true: '#660000' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {includeSchedule && (
          <View className="mb-6">
            {/* Mode selector */}
            <View className="flex-row gap-2 mb-4">
              <Pressable
                className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border-2 ${
                  scheduleMode === 'one-time'
                    ? 'bg-primary/10 border-primary'
                    : 'bg-card border-border'
                }`}
                onPress={() => setScheduleMode('one-time')}
              >
                <Ionicons
                  name="calendar-number-outline"
                  size={18}
                  color={scheduleMode === 'one-time' ? '#660000' : '#78716C'}
                />
                <View>
                  <Text
                    className={`text-sm font-semibold ${
                      scheduleMode === 'one-time' ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    One-time
                  </Text>
                  <Text className="text-[10px] text-muted-foreground">Single date</Text>
                </View>
              </Pressable>

              <Pressable
                className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border-2 ${
                  scheduleMode === 'recurring'
                    ? 'bg-primary/10 border-primary'
                    : 'bg-card border-border'
                }`}
                onPress={() => setScheduleMode('recurring')}
              >
                <Ionicons
                  name="repeat-outline"
                  size={18}
                  color={scheduleMode === 'recurring' ? '#660000' : '#78716C'}
                />
                <View>
                  <Text
                    className={`text-sm font-semibold ${
                      scheduleMode === 'recurring' ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    Recurring
                  </Text>
                  <Text className="text-[10px] text-muted-foreground">Weekly repeat</Text>
                </View>
              </Pressable>
            </View>

            {/* ── ONE-TIME UI ── */}
            {scheduleMode === 'one-time' && (
              <>
                {/* Date */}
                <View className="p-4 rounded-xl border border-border bg-card mb-3">
                  <DateTimePickerField
                    label="Date *"
                    value={oneTimeDate}
                    onChange={setOneTimeDate}
                    mode="date"
                    minimumDate={new Date()}
                    placeholder="Select a date"
                  />
                </View>

                {/* Time */}
                <View className="p-4 rounded-xl border border-border bg-card mb-3">
                  <Text className="text-sm font-semibold text-foreground mb-3">Time *</Text>
                  <View className="flex-row gap-3 items-end">
                    <TimeField label="From" value={oneTimeStartTime} onChange={setOneTimeStartTime} />
                    <View className="pb-3">
                      <View className="w-6 h-6 rounded-full bg-muted justify-center items-center">
                        <Ionicons name="arrow-forward" size={12} color="#78716C" />
                      </View>
                    </View>
                    <TimeField label="To" value={oneTimeEndTime} onChange={setOneTimeEndTime} />
                  </View>
                </View>

                {/* Capacity */}
                <View className="p-4 rounded-xl border border-border bg-card mb-3">
                  <Text className="text-sm font-semibold text-foreground mb-3">Capacity</Text>
                  <CapacityInputs
                    slotsAvailable={oneTimeSlots}
                    slotLabel={oneTimeSlotLabel}
                    onSlotsChange={setOneTimeSlots}
                    onLabelChange={setOneTimeSlotLabel}
                  />
                </View>

                {/* Preview */}
                <View className="p-4 rounded-xl border border-primary/30 bg-primary/10">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Ionicons name="calendar" size={16} color="#660000" />
                    <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Preview
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold text-foreground">
                    {formatDateDisplay(oneTimeDate)} from {oneTimeStartTime} to {oneTimeEndTime}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {oneTimeSlots} {oneTimeSlotLabel || 'slots'} available
                  </Text>
                </View>
              </>
            )}

            {/* ── RECURRING UI ── */}
            {scheduleMode === 'recurring' && (
              <>
                {/* Days */}
                <View className="p-4 rounded-xl border border-border bg-card mb-3">
                  <View className="flex-row justify-between items-center mb-3">
                    <Text className="text-sm font-semibold text-foreground">Repeat on *</Text>
                    <Text className="text-xs text-muted-foreground">{selectedDays.length} selected</Text>
                  </View>

                  <View className="flex-row justify-between gap-1 mb-3">
                    {RRULE_WEEKDAYS.map((day) => {
                      const isSelected = selectedDays.includes(day);
                      return (
                        <Pressable
                          key={day}
                          className={`flex-1 py-2.5 rounded-xl items-center border-2 ${
                            isSelected ? 'bg-primary border-primary' : 'bg-muted border-border'
                          }`}
                          onPress={() => toggleDay(day)}
                        >
                          <Text
                            className={`text-[11px] font-semibold ${
                              isSelected ? 'text-primary-foreground' : 'text-foreground'
                            }`}
                          >
                            {WEEKDAY_LABELS[day]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View className="flex-row gap-2">
                    <Pressable
                      className={`flex-row items-center px-3 py-1.5 rounded-full border ${
                        isWeekdaysPreset ? 'bg-primary border-primary' : 'bg-muted border-border'
                      }`}
                      onPress={() => selectPreset('weekdays')}
                    >
                      <Text className={`text-xs font-medium ${isWeekdaysPreset ? 'text-primary-foreground' : 'text-foreground'}`}>
                        Weekdays
                      </Text>
                    </Pressable>
                    <Pressable
                      className={`flex-row items-center px-3 py-1.5 rounded-full border ${
                        isWeekendPreset ? 'bg-primary border-primary' : 'bg-muted border-border'
                      }`}
                      onPress={() => selectPreset('weekend')}
                    >
                      <Text className={`text-xs font-medium ${isWeekendPreset ? 'text-primary-foreground' : 'text-foreground'}`}>
                        Weekend
                      </Text>
                    </Pressable>
                    <Pressable
                      className={`flex-row items-center px-3 py-1.5 rounded-full border ${
                        isAllPreset ? 'bg-primary border-primary' : 'bg-muted border-border'
                      }`}
                      onPress={() => selectPreset('all')}
                    >
                      <Text className={`text-xs font-medium ${isAllPreset ? 'text-primary-foreground' : 'text-foreground'}`}>
                        Every day
                      </Text>
                    </Pressable>
                  </View>
                </View>

                {/* Time */}
                <View className="p-4 rounded-xl border border-border bg-card mb-3">
                  <Text className="text-sm font-semibold text-foreground mb-3">Time Window *</Text>
                  <View className="flex-row gap-3 items-end">
                    <TimeField label="From" value={recurStartTime} onChange={setRecurStartTime} />
                    <View className="pb-3">
                      <View className="w-6 h-6 rounded-full bg-muted justify-center items-center">
                        <Ionicons name="arrow-forward" size={12} color="#78716C" />
                      </View>
                    </View>
                    <TimeField label="To" value={recurEndTime} onChange={setRecurEndTime} />
                  </View>
                </View>

                {/* Date range */}
                <View className="p-4 rounded-xl border border-border bg-card mb-3">
                  <Text className="text-sm font-semibold text-foreground mb-2">Active Period</Text>
                  <DateTimePickerField
                    label="Starts *"
                    value={dtstart}
                    onChange={setDtstart}
                    mode="date"
                    minimumDate={new Date()}
                    placeholder="Select start date"
                  />
                  <DateTimePickerField
                    label="Ends (optional)"
                    value={dtend}
                    onChange={setDtend}
                    mode="date"
                    minimumDate={dtstart ? new Date(dtstart) : new Date()}
                    placeholder="No end date"
                  />
                </View>

                {/* Capacity */}
                <View className="p-4 rounded-xl border border-border bg-card mb-3">
                  <Text className="text-sm font-semibold text-foreground mb-3">Capacity</Text>
                  <CapacityInputs
                    slotsAvailable={recurSlots}
                    slotLabel={recurSlotLabel}
                    onSlotsChange={setRecurSlots}
                    onLabelChange={setRecurSlotLabel}
                  />
                </View>

                {/* Preview */}
                <View className="p-4 rounded-xl border border-primary/30 bg-primary/10">
                  <View className="flex-row items-center gap-1.5 mb-1">
                    <Ionicons name="repeat" size={16} color="#660000" />
                    <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
                      Preview
                    </Text>
                  </View>
                  <Text className="text-sm font-semibold text-foreground">
                    Every{' '}
                    {isAllPreset
                      ? 'day'
                      : isWeekdaysPreset
                        ? 'weekday'
                        : isWeekendPreset
                          ? 'weekend'
                          : selectedDays.map((d) => WEEKDAY_LABELS[d]).join(', ')}
                    {' '}from {recurStartTime} to {recurEndTime}
                  </Text>
                  <Text className="text-xs text-muted-foreground mt-0.5">
                    {recurSlots} {recurSlotLabel || 'slots'} per day
                    {dtend ? ` \u2022 Until ${formatDateDisplay(dtend)}` : ' \u2022 No end date'}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── Submit ── */}
        <Pressable
          className={`rounded-xl py-4 items-center mt-2 ${
            isSubmitting ? 'bg-muted' : 'bg-primary'
          }`}
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">
              Create Offering
            </Text>
          )}
        </Pressable>
      </ScrollView>
    </>
  );
}
