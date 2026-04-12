import { createOffering, createOfferingSchedule } from '@/lib/api/offerings';
import { buildWeeklyRRule } from '@/types/offering';
import type { CreateOfferingInput, RRuleWeekday, TransactionType } from '@/types/offering';
import type { OfferingFormState } from './form-state';
import { isLoanOffering, isScheduleRequired, isServiceOffering } from './form-state';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isoToDateStr(iso: string): string {
  return iso.split('T')[0];
}

/** Map a YYYY-MM-DD date string to the RRULE weekday code for that date. */
function dateToWeekday(dateStr: string): RRuleWeekday {
  const dayIndex = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun
  const map: RRuleWeekday[] = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  return map[dayIndex];
}

// ─── Validation ──────────────────────────────────────────────────────────────

/**
 * Validates the form state. Returns null if valid, or an error message string.
 */
export function validateForm(state: OfferingFormState): string | null {
  if (!state.title.trim()) return 'Title is required';

  const isLoan = isLoanOffering(state);

  // Deposit validation for loans
  if (isLoan && state.requiresDeposit) {
    const parsedDeposit = parseFloat(state.depositAmount);
    if (!state.depositAmount || isNaN(parsedDeposit) || parsedDeposit <= 0) {
      return 'Deposit amount is required when deposit is enabled';
    }
  }

  // Loan duration validation
  if (isLoan) {
    const dur = parseInt(state.loanDurationDays);
    const maxDur = state.loanMaxDurationDays ? parseInt(state.loanMaxDurationDays) : null;
    if (!dur || dur < 1) return 'Default loan duration must be at least 1 day';
    if (maxDur !== null && maxDur < dur) {
      return 'Max loan duration must be greater than or equal to default';
    }
  }

  // Schedule required for services, events, and loans
  if (isScheduleRequired(state) && !state.includeSchedule) {
    return isLoan
      ? 'Loan offerings must have a schedule with loan duration terms.'
      : 'Services and events require a schedule.';
  }

  // Schedule field validation
  if (state.includeSchedule) {
    const st = state.scheduleMode === 'one-time' ? state.oneTimeStartTime : state.recurStartTime;
    const et = state.scheduleMode === 'one-time' ? state.oneTimeEndTime : state.recurEndTime;
    const slots = state.scheduleMode === 'one-time' ? state.oneTimeSlots : state.recurSlots;

    if (!st || !et) return 'Start and end time are required';
    if (et <= st) return 'End time must be after start time';
    if (!slots || parseInt(slots) < 1) return 'At least 1 slot is required';

    if (state.scheduleMode === 'one-time' && !state.oneTimeDate) {
      return 'Date is required for a one-time offering';
    }
    if (state.scheduleMode === 'recurring' && !state.dtstart) {
      return 'Start date is required for a recurring schedule';
    }
  }

  return null;
}

// ─── Submit ──────────────────────────────────────────────────────────────────

interface SubmitParams {
  state: OfferingFormState;
  communityId: string;
}

interface SubmitResult {
  offeringId: string;
}

export async function submitOfferingForm({
  state,
  communityId,
}: SubmitParams): Promise<SubmitResult> {
  const isLoan = isLoanOffering(state);
  const parsedPrice = state.priceAmount ? parseFloat(state.priceAmount) : 0;

  // Compute final transaction_type
  const finalTransactionType: TransactionType =
    state.category === 'product' ? state.transactionType : 'booking';

  // Compute price_type from the price amount (legacy field)
  const finalPriceType = parsedPrice > 0 ? 'fixed' : 'free';

  const input: CreateOfferingInput = {
    title: state.title.trim(),
    category: state.category,
    transaction_type: finalTransactionType,
    price_type: finalPriceType,
    fulfillment_method: state.fulfillmentMethod,
  };

  if (state.description.trim()) input.description = state.description.trim();
  if (parsedPrice > 0) input.price_amount = parsedPrice;

  if (isLoan) {
    input.requires_deposit = state.requiresDeposit;
    if (state.requiresDeposit && state.depositAmount) {
      input.deposit_amount = parseFloat(state.depositAmount);
    }
  }

  const offering = await createOffering(communityId, input);

  // Create schedule if included
  if (state.includeSchedule) {
    const loanFields = isLoan
      ? {
          loan_duration_days: parseInt(state.loanDurationDays),
          loan_max_duration_days: state.loanMaxDurationDays
            ? parseInt(state.loanMaxDurationDays)
            : null,
        }
      : {};

    const slotDurationFields = isServiceOffering(state) && state.slotDurationMinutes
      ? { slot_duration_minutes: parseInt(state.slotDurationMinutes) }
      : {};

    if (state.scheduleMode === 'one-time') {
      const dateStr = isoToDateStr(state.oneTimeDate!);
      const dayCode = dateToWeekday(dateStr);
      await createOfferingSchedule(offering.id, {
        rrule: buildWeeklyRRule([dayCode]),
        dtstart: dateStr,
        dtend: dateStr, // Same date = single occurrence
        start_time: state.oneTimeStartTime,
        end_time: state.oneTimeEndTime,
        slots_available: parseInt(state.oneTimeSlots),
        slot_label: state.oneTimeSlotLabel.trim() || undefined,
        is_active: true,
        ...loanFields,
        ...slotDurationFields,
      } as any);
    } else {
      await createOfferingSchedule(offering.id, {
        rrule: buildWeeklyRRule(state.selectedDays),
        dtstart: isoToDateStr(state.dtstart!),
        dtend: state.dtend ? isoToDateStr(state.dtend) : null,
        start_time: state.recurStartTime,
        end_time: state.recurEndTime,
        slots_available: parseInt(state.recurSlots),
        slot_label: state.recurSlotLabel.trim() || undefined,
        is_active: true,
        ...loanFields,
        ...slotDurationFields,
      } as any);
    }
  }

  return { offeringId: offering.id };
}
