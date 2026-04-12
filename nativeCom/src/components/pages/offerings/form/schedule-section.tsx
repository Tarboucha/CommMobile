import { View, Pressable, Switch, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { DateTimePickerField } from '@/components/shared/date-time-picker-field';
import { RRULE_WEEKDAYS, WEEKDAY_LABELS } from '@/types/offering';
import { TimeField } from './time-field';
import { CapacityInputs } from './capacity-inputs';
import type { OfferingFormState, OfferingFormAction } from './form-state';
import {
  isLoanOffering,
  isServiceOffering,
  isWeekdaysPreset,
  isWeekendPreset,
  isAllPreset,
  setField,
} from './form-state';

interface Props {
  state: OfferingFormState;
  dispatch: (action: OfferingFormAction) => void;
}

function formatDateDisplay(iso: string | null): string {
  if (!iso) return 'Not set';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function ScheduleSection({ state, dispatch }: Props) {
  const isLoan = isLoanOffering(state);
  const isService = isServiceOffering(state);

  return (
    <>
      {/* Toggle */}
      <View className="flex-row items-center justify-between p-4 rounded-xl border border-border bg-card mb-4">
        <View className="flex-row items-center gap-3">
          <View className="w-9 h-9 rounded-lg bg-primary/15 justify-center items-center">
            <Ionicons name="calendar-outline" size={18} color="#660000" />
          </View>
          <View>
            <Text className="text-sm font-semibold text-foreground">Availability Schedule</Text>
            <Text className="text-xs text-muted-foreground">
              Set when this offering is available
            </Text>
          </View>
        </View>
        <Switch
          value={state.includeSchedule}
          onValueChange={(v) => dispatch(setField('includeSchedule', v))}
          trackColor={{ false: '#D6D3D1', true: '#660000' }}
          thumbColor="#FFFFFF"
        />
      </View>

      {state.includeSchedule && (
        <View className="mb-6">
          {/* Loan duration */}
          {isLoan && <LoanDurationFields state={state} dispatch={dispatch} />}

          {/* Slot duration (services only) */}
          {isService && <SlotDurationField state={state} dispatch={dispatch} />}

          {/* Mode tabs */}
          <ModeTabs state={state} dispatch={dispatch} />

          {/* Mode content */}
          {state.scheduleMode === 'one-time' && (
            <OneTimeFields state={state} dispatch={dispatch} />
          )}
          {state.scheduleMode === 'recurring' && (
            <RecurringFields state={state} dispatch={dispatch} />
          )}
        </View>
      )}
    </>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function LoanDurationFields({ state, dispatch }: Props) {
  return (
    <View className="p-4 rounded-xl border border-border bg-card mb-3">
      <Text className="text-sm font-semibold text-foreground mb-3">Loan Duration</Text>
      <View className="flex-row gap-3">
        <View className="flex-1 gap-1">
          <Text className="text-xs text-muted-foreground">Default (days) *</Text>
          <TextInput
            className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-muted"
            placeholder="7"
            placeholderTextColor="#78716C"
            value={state.loanDurationDays}
            onChangeText={(v) => dispatch(setField('loanDurationDays', v))}
            keyboardType="number-pad"
          />
        </View>
        <View className="flex-1 gap-1">
          <Text className="text-xs text-muted-foreground">Max (days)</Text>
          <TextInput
            className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-muted"
            placeholder="14"
            placeholderTextColor="#78716C"
            value={state.loanMaxDurationDays}
            onChangeText={(v) => dispatch(setField('loanMaxDurationDays', v))}
            keyboardType="number-pad"
          />
        </View>
      </View>
      <Text className="text-xs text-muted-foreground mt-2">
        How long borrowers can keep the item. Max is optional.
      </Text>
    </View>
  );
}

const DURATION_OPTIONS = [
  { label: 'Full window (no time slots)', value: '' },
  { label: '15 min', value: '15' },
  { label: '30 min', value: '30' },
  { label: '45 min', value: '45' },
  { label: '1 hour', value: '60' },
  { label: '1.5 hours', value: '90' },
  { label: '2 hours', value: '120' },
];

function SlotDurationField({ state, dispatch }: Props) {
  return (
    <View className="p-4 rounded-xl border border-border bg-card mb-3">
      <Text className="text-sm font-semibold text-foreground mb-1">Appointment Duration</Text>
      <Text className="text-xs text-muted-foreground mb-3">
        How long each appointment lasts. Customers will pick a specific time slot.
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {DURATION_OPTIONS.map((opt) => {
          const isActive = state.slotDurationMinutes === opt.value;
          return (
            <Pressable
              key={opt.value}
              className={`px-3 py-2 rounded-lg border-2 ${
                isActive ? 'bg-primary/10 border-primary' : 'bg-muted border-border'
              }`}
              onPress={() => dispatch(setField('slotDurationMinutes', opt.value))}
            >
              <Text
                className={`text-xs font-medium ${
                  isActive ? 'text-primary' : 'text-foreground'
                }`}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ModeTabs({ state, dispatch }: Props) {
  return (
    <View className="flex-row gap-2 mb-4">
      <Pressable
        className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border-2 ${
          state.scheduleMode === 'one-time'
            ? 'bg-primary/10 border-primary'
            : 'bg-card border-border'
        }`}
        onPress={() => dispatch(setField('scheduleMode', 'one-time'))}
      >
        <Ionicons
          name="calendar-number-outline"
          size={18}
          color={state.scheduleMode === 'one-time' ? '#660000' : '#78716C'}
        />
        <View>
          <Text
            className={`text-sm font-semibold ${
              state.scheduleMode === 'one-time' ? 'text-primary' : 'text-foreground'
            }`}
          >
            One-time
          </Text>
          <Text className="text-[10px] text-muted-foreground">Single date</Text>
        </View>
      </Pressable>

      <Pressable
        className={`flex-1 flex-row items-center justify-center gap-2 py-3 rounded-xl border-2 ${
          state.scheduleMode === 'recurring'
            ? 'bg-primary/10 border-primary'
            : 'bg-card border-border'
        }`}
        onPress={() => dispatch(setField('scheduleMode', 'recurring'))}
      >
        <Ionicons
          name="repeat-outline"
          size={18}
          color={state.scheduleMode === 'recurring' ? '#660000' : '#78716C'}
        />
        <View>
          <Text
            className={`text-sm font-semibold ${
              state.scheduleMode === 'recurring' ? 'text-primary' : 'text-foreground'
            }`}
          >
            Recurring
          </Text>
          <Text className="text-[10px] text-muted-foreground">Weekly repeat</Text>
        </View>
      </Pressable>
    </View>
  );
}

function OneTimeFields({ state, dispatch }: Props) {
  return (
    <>
      {/* Date */}
      <View className="p-4 rounded-xl border border-border bg-card mb-3">
        <DateTimePickerField
          label="Date *"
          value={state.oneTimeDate}
          onChange={(v) => dispatch(setField('oneTimeDate', v))}
          mode="date"
          minimumDate={new Date()}
          placeholder="Select a date"
        />
      </View>

      {/* Time */}
      <View className="p-4 rounded-xl border border-border bg-card mb-3">
        <Text className="text-sm font-semibold text-foreground mb-3">Time *</Text>
        <View className="flex-row gap-3 items-end">
          <TimeField
            label="From"
            value={state.oneTimeStartTime}
            onChange={(v) => dispatch(setField('oneTimeStartTime', v))}
          />
          <View className="pb-3">
            <View className="w-6 h-6 rounded-full bg-muted justify-center items-center">
              <Ionicons name="arrow-forward" size={12} color="#78716C" />
            </View>
          </View>
          <TimeField
            label="To"
            value={state.oneTimeEndTime}
            onChange={(v) => dispatch(setField('oneTimeEndTime', v))}
          />
        </View>
      </View>

      {/* Capacity */}
      <View className="p-4 rounded-xl border border-border bg-card mb-3">
        <Text className="text-sm font-semibold text-foreground mb-3">Capacity</Text>
        <CapacityInputs
          slotsAvailable={state.oneTimeSlots}
          slotLabel={state.oneTimeSlotLabel}
          onSlotsChange={(v) => dispatch(setField('oneTimeSlots', v))}
          onLabelChange={(v) => dispatch(setField('oneTimeSlotLabel', v))}
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
          {formatDateDisplay(state.oneTimeDate)} from {state.oneTimeStartTime} to{' '}
          {state.oneTimeEndTime}
        </Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          {state.oneTimeSlots} {state.oneTimeSlotLabel || 'slots'} available
        </Text>
      </View>
    </>
  );
}

function RecurringFields({ state, dispatch }: Props) {
  const weekdaysPreset = isWeekdaysPreset(state.selectedDays);
  const weekendPreset = isWeekendPreset(state.selectedDays);
  const allPreset = isAllPreset(state.selectedDays);

  return (
    <>
      {/* Days */}
      <View className="p-4 rounded-xl border border-border bg-card mb-3">
        <View className="flex-row justify-between items-center mb-3">
          <Text className="text-sm font-semibold text-foreground">Repeat on *</Text>
          <Text className="text-xs text-muted-foreground">
            {state.selectedDays.length} selected
          </Text>
        </View>

        <View className="flex-row justify-between gap-1 mb-3">
          {RRULE_WEEKDAYS.map((day) => {
            const isSelected = state.selectedDays.includes(day);
            return (
              <Pressable
                key={day}
                className={`flex-1 py-2.5 rounded-xl items-center border-2 ${
                  isSelected ? 'bg-primary border-primary' : 'bg-muted border-border'
                }`}
                onPress={() => dispatch({ type: 'TOGGLE_DAY', day })}
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
          <PresetChip
            active={weekdaysPreset}
            label="Weekdays"
            onPress={() => dispatch({ type: 'SELECT_DAYS_PRESET', preset: 'weekdays' })}
          />
          <PresetChip
            active={weekendPreset}
            label="Weekend"
            onPress={() => dispatch({ type: 'SELECT_DAYS_PRESET', preset: 'weekend' })}
          />
          <PresetChip
            active={allPreset}
            label="Every day"
            onPress={() => dispatch({ type: 'SELECT_DAYS_PRESET', preset: 'all' })}
          />
        </View>
      </View>

      {/* Time */}
      <View className="p-4 rounded-xl border border-border bg-card mb-3">
        <Text className="text-sm font-semibold text-foreground mb-3">Time Window *</Text>
        <View className="flex-row gap-3 items-end">
          <TimeField
            label="From"
            value={state.recurStartTime}
            onChange={(v) => dispatch(setField('recurStartTime', v))}
          />
          <View className="pb-3">
            <View className="w-6 h-6 rounded-full bg-muted justify-center items-center">
              <Ionicons name="arrow-forward" size={12} color="#78716C" />
            </View>
          </View>
          <TimeField
            label="To"
            value={state.recurEndTime}
            onChange={(v) => dispatch(setField('recurEndTime', v))}
          />
        </View>
      </View>

      {/* Date range */}
      <View className="p-4 rounded-xl border border-border bg-card mb-3">
        <Text className="text-sm font-semibold text-foreground mb-2">Active Period</Text>
        <DateTimePickerField
          label="Starts *"
          value={state.dtstart}
          onChange={(v) => dispatch(setField('dtstart', v))}
          mode="date"
          minimumDate={new Date()}
          placeholder="Select start date"
        />
        <DateTimePickerField
          label="Ends (optional)"
          value={state.dtend}
          onChange={(v) => dispatch(setField('dtend', v))}
          mode="date"
          minimumDate={state.dtstart ? new Date(state.dtstart) : new Date()}
          placeholder="No end date"
        />
      </View>

      {/* Capacity */}
      <View className="p-4 rounded-xl border border-border bg-card mb-3">
        <Text className="text-sm font-semibold text-foreground mb-3">Capacity</Text>
        <CapacityInputs
          slotsAvailable={state.recurSlots}
          slotLabel={state.recurSlotLabel}
          onSlotsChange={(v) => dispatch(setField('recurSlots', v))}
          onLabelChange={(v) => dispatch(setField('recurSlotLabel', v))}
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
          {allPreset
            ? 'day'
            : weekdaysPreset
              ? 'weekday'
              : weekendPreset
                ? 'weekend'
                : state.selectedDays.map((d) => WEEKDAY_LABELS[d]).join(', ')}{' '}
          from {state.recurStartTime} to {state.recurEndTime}
        </Text>
        <Text className="text-xs text-muted-foreground mt-0.5">
          {state.recurSlots} {state.recurSlotLabel || 'slots'} per day
          {state.dtend ? ` \u2022 Until ${formatDateDisplay(state.dtend)}` : ' \u2022 No end date'}
        </Text>
      </View>
    </>
  );
}

function PresetChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      className={`flex-row items-center px-3 py-1.5 rounded-full border ${
        active ? 'bg-primary border-primary' : 'bg-muted border-border'
      }`}
      onPress={onPress}
    >
      <Text
        className={`text-xs font-medium ${
          active ? 'text-primary-foreground' : 'text-foreground'
        }`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
