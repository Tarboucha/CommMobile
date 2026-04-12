import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { DateTimePickerField } from '@/components/shared/date-time-picker-field';
import { DirectBookingSheet } from './direct-booking-sheet';
import { computeLoanDueDate, formatDateYMD } from '@/lib/direct-booking';
import type { Offering, AvailabilitySchedule } from '@/types/offering';

interface LoanBookingSheetProps {
  visible: boolean;
  offering: Offering;
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

export function LoanBookingSheet({ visible, offering, onClose }: LoanBookingSheetProps) {
  const schedule = getActiveSchedule(offering);

  // Default start date = today
  const today = useMemo(() => formatDateYMD(new Date()), []);
  const [startDateISO, setStartDateISO] = useState<string | null>(new Date().toISOString());

  // No schedule → can't book a loan, show error
  if (!schedule) {
    return (
      <DirectBookingSheet
        visible={visible}
        offering={offering}
        title="Borrow"
        confirmLabel="Unavailable"
        onClose={onClose}
        customContent={
          <View className="p-4 rounded-lg bg-destructive/10 border border-destructive/30">
            <View className="flex-row items-center gap-2 mb-1">
              <Ionicons name="alert-circle" size={18} color="#DC2626" />
              <Text className="text-sm font-semibold text-destructive">No schedule</Text>
            </View>
            <Text className="text-xs text-muted-foreground">
              This loan offering has no availability schedule. The provider needs to add one
              before it can be booked.
            </Text>
          </View>
        }
      />
    );
  }

  const durationDays = schedule.loan_duration_days;
  const startDate = startDateISO ? formatDateYMD(new Date(startDateISO)) : today;
  const dueDate = computeLoanDueDate(startDate, durationDays);

  // Pricing
  const rentalFee = (offering.price_amount ?? 0) > 0 ? offering.price_amount! : 0;
  const depositAmount =
    offering.requires_deposit && offering.deposit_amount ? offering.deposit_amount : 0;
  const total = rentalFee + depositAmount;
  const currency = offering.currency_code;

  // Build summary lines
  const summaryLines: { label: string; value: string }[] = [];
  if (rentalFee > 0) {
    summaryLines.push({
      label: 'Rental fee',
      value: formatCurrency(rentalFee, currency),
    });
  } else {
    summaryLines.push({ label: 'Rental fee', value: 'Free' });
  }
  if (depositAmount > 0) {
    summaryLines.push({
      label: 'Security deposit',
      value: formatCurrency(depositAmount, currency),
    });
  }

  // Loan-specific custom content: date picker + computed return date
  const customContent = (
    <View className="gap-4">
      {/* Pickup date */}
      <View className="p-4 rounded-xl border border-border bg-card">
        <DateTimePickerField
          label="Pickup date *"
          value={startDateISO}
          onChange={setStartDateISO}
          mode="date"
          minimumDate={new Date()}
          placeholder="Select pickup date"
        />
      </View>

      {/* Computed return date */}
      <View className="p-4 rounded-xl border border-primary/30 bg-primary/10 gap-2">
        <View className="flex-row items-center gap-2">
          <Ionicons name="calendar-outline" size={18} color="#660000" />
          <Text className="text-xs font-semibold uppercase tracking-wide text-primary">
            Loan period
          </Text>
        </View>
        <View className="flex-row items-center gap-2">
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">Pickup</Text>
            <Text className="text-sm font-semibold text-foreground">
              {formatDateDisplay(startDate)}
            </Text>
          </View>
          <Ionicons name="arrow-forward" size={18} color="#660000" />
          <View className="flex-1">
            <Text className="text-xs text-muted-foreground">Return by</Text>
            <Text className="text-sm font-semibold text-foreground">
              {formatDateDisplay(dueDate)}
            </Text>
          </View>
        </View>
        <Text className="text-xs text-muted-foreground">
          {durationDays} {durationDays === 1 ? 'day' : 'days'}
        </Text>
      </View>

      {/* Deposit notice */}
      {depositAmount > 0 && (
        <View className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex-row gap-2">
          <Ionicons name="information-circle" size={18} color="#D97706" />
          <Text className="text-xs text-amber-800 flex-1">
            A security deposit of {formatCurrency(depositAmount, currency)} is required. It
            will be refunded when you return the item in good condition.
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <DirectBookingSheet
      visible={visible}
      offering={offering}
      title="Borrow"
      confirmLabel={`Confirm — ${formatCurrency(total, currency)}`}
      customContent={customContent}
      bookingParams={{
        scheduleId: schedule.id,
        instanceDate: startDate,
        loanStartDate: startDate,
        loanDueDate: dueDate,
        quantity: 1,
      }}
      summaryLines={summaryLines}
      totalLabel={formatCurrency(total, currency)}
      onClose={onClose}
    />
  );
}
