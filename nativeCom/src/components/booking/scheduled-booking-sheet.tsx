import { useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { DateTimePickerField } from '@/components/shared/date-time-picker-field';
import { DirectBookingSheet } from './direct-booking-sheet';
import { TimeSlotList } from './time-slot-list';
import { formatDateYMD } from '@/lib/direct-booking';
import type { Offering, AvailabilitySchedule, TimeSlot } from '@/types/offering';

interface ScheduledBookingSheetProps {
  visible: boolean;
  offering: Offering;
  /** "Book" for services, "RSVP" for events */
  mode: 'service' | 'event';
  onClose: () => void;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

function formatDateDisplay(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getActiveSchedule(offering: Offering): AvailabilitySchedule | null {
  return offering.availability_schedules?.find((s) => s.is_active) ?? null;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ScheduledBookingSheet({
  visible,
  offering,
  mode,
  onClose,
}: ScheduledBookingSheetProps) {
  const schedule = getActiveSchedule(offering);

  const [dateISO, setDateISO] = useState<string | null>(new Date().toISOString());
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const isService = mode === 'service';
  const title = isService ? 'Book' : 'RSVP';
  const confirmPrefix = isService ? 'Book' : 'RSVP';

  const isTimeSlotted = !!schedule?.slot_duration_minutes;

  // No schedule → error
  if (!schedule) {
    return (
      <DirectBookingSheet
        visible={visible}
        offering={offering}
        title={title}
        confirmLabel="Unavailable"
        onClose={onClose}
        customContent={
          <View className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <View className="flex-row items-center gap-2 mb-1">
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text className="text-sm font-semibold text-destructive">No schedule</Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              This offering has no availability schedule. The provider needs to add one
              before it can be booked.
            </Text>
          </View>
        }
      />
    );
  }

  const instanceDate = dateISO ? formatDateYMD(new Date(dateISO)) : formatDateYMD(new Date());

  // Reset selected slot when date changes
  const handleDateChange = (newDate: string | null) => {
    setDateISO(newDate);
    setSelectedSlot(null);
  };

  // Pricing
  const price = (offering.price_amount ?? 0) > 0 ? offering.price_amount! : 0;
  const currency = offering.currency_code;

  // Summary
  const summaryLines: { label: string; value: string }[] = [
    {
      label: isService ? 'Service fee' : 'Ticket price',
      value: price > 0 ? formatCurrency(price, currency) : 'Free',
    },
  ];

  if (isTimeSlotted && selectedSlot) {
    summaryLines.unshift({
      label: 'Time',
      value: `${selectedSlot.start_time} – ${selectedSlot.end_time}`,
    });
  }

  // Custom content: date picker + time slot picker or static time window
  const customContent = (
    <View className="gap-4">
      <View className="p-4 rounded-xl border border-border bg-card">
        <DateTimePickerField
          label={isService ? 'Service date *' : 'Event date *'}
          value={dateISO}
          onChange={handleDateChange}
          mode="date"
          minimumDate={new Date()}
          placeholder="Select a date"
        />
      </View>

      {isTimeSlotted ? (
        <TimeSlotList
          offeringId={offering.id}
          scheduleId={schedule.id}
          date={instanceDate}
          selectedSlot={selectedSlot}
          onSelectSlot={setSelectedSlot}
        />
      ) : (
        <View className="p-4 rounded-xl border border-primary/30 bg-primary/10 gap-2">
          <View className="flex-row items-center gap-2">
            <Ionicons name="time-outline" size={18} color="#660000" />
            <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
              Time window
            </Text>
          </View>
          <Text className="text-sm font-semibold text-foreground">
            {formatDateDisplay(instanceDate)}
          </Text>
          <Text className="text-xs text-muted-foreground">
            From {schedule.start_time} to {schedule.end_time}
          </Text>
        </View>
      )}
    </View>
  );

  // Disable confirm when time-slotted but no slot selected
  const canConfirm = !isTimeSlotted || selectedSlot !== null;

  return (
    <DirectBookingSheet
      visible={visible}
      offering={offering}
      title={title}
      confirmLabel={
        price > 0 ? `${confirmPrefix} — ${formatCurrency(price, currency)}` : `${confirmPrefix} — Free`
      }
      confirmDisabled={!canConfirm}
      customContent={customContent}
      bookingParams={{
        scheduleId: schedule.id,
        instanceDate,
        quantity: 1,
        ...(selectedSlot && {
          instanceStartTime: selectedSlot.start_time,
          instanceEndTime: selectedSlot.end_time,
        }),
      }}
      summaryLines={summaryLines}
      totalLabel={price > 0 ? formatCurrency(price, currency) : 'Free'}
      onClose={onClose}
    />
  );
}
