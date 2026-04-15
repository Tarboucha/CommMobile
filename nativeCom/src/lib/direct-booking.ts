/**
 * Direct booking helper — builds a single-item BookingCreatePayload from an
 * offering and the user-provided booking details. Used by the loan, service,
 * and event booking sheets that bypass the cart entirely.
 *
 * The actual API call goes through the existing `useCreateBooking` mutation
 * (TanStack Query), so this file only handles the payload shape.
 */

import { generateUUID } from '@/lib/utils/uuid';
import type { Offering } from '@/types/offering';
import type { BookingCreatePayload, BookingItemPayload } from '@/types/booking';

export interface DirectBookingParams {
  offering: Offering;
  /** For scheduled bookings (services/events), the schedule + instance date */
  scheduleId?: string | null;
  instanceDate?: string | null;
  /** For time-slotted services, the selected time slot */
  instanceStartTime?: string | null;
  instanceEndTime?: string | null;
  /** For loan bookings, the loan period */
  loanStartDate?: string;
  loanDueDate?: string;
  /** Quantity (default 1 for loans, configurable for services/events) */
  quantity?: number;
  /** Payment method chosen by the user */
  paymentMethod: 'cash' | 'external';
  /** Required when fulfillment is delivery */
  deliveryAddressId?: string | null;
  /** Optional notes */
  specialInstructions?: string;
  /** Optional override of profile phone */
  contactPhone?: string;
  /** Optional initial offer (counter-price the customer wants to propose) */
  offerAmount?: number;
  /** Optional note explaining the offer */
  offerNote?: string;
}

/**
 * Build a `BookingCreatePayload` for a single offering, with the appropriate
 * loan / scheduled fields filled in based on the offering's transaction type.
 */
export function buildDirectBookingPayload(
  params: DirectBookingParams
): BookingCreatePayload {
  const {
    offering,
    scheduleId = null,
    instanceDate = null,
    instanceStartTime = null,
    instanceEndTime = null,
    loanStartDate,
    loanDueDate,
    quantity = 1,
    paymentMethod,
    deliveryAddressId = null,
    specialInstructions,
    contactPhone,
    offerAmount,
    offerNote,
  } = params;

  const isLoan = offering.transaction_type === 'loan';

  const item: BookingItemPayload = {
    offering_id: offering.id,
    offering_version: offering.version,
    quantity,
    fulfillment_method: offering.fulfillment_method,
    schedule_id: scheduleId,
    instance_date: instanceDate,
    instance_start_time: instanceStartTime,
    instance_end_time: instanceEndTime,
  };

  if (specialInstructions?.trim()) {
    item.special_instructions = specialInstructions.trim();
  }

  if (isLoan) {
    if (!loanStartDate || !loanDueDate) {
      throw new Error('Loan booking requires loan_start_date and loan_due_date');
    }
    item.is_loan = true;
    item.loan_start_date = loanStartDate;
    item.loan_due_date = loanDueDate;
    if (offering.requires_deposit && offering.deposit_amount) {
      item.deposit_amount = offering.deposit_amount;
    }
  }

  return {
    community_id: offering.community_id,
    items: [item],
    payment_method: paymentMethod,
    delivery_address_id:
      offering.fulfillment_method === 'delivery' ? deliveryAddressId : null,
    special_instructions: specialInstructions?.trim() || undefined,
    contact_phone: contactPhone?.trim() || undefined,
    idempotency_key: generateUUID(),
    ...(offerAmount && offerAmount > 0 && { offer_amount: offerAmount }),
    ...(offerAmount && offerAmount > 0 && offerNote?.trim() && { offer_note: offerNote.trim() }),
  };
}

// ─── Date helpers for loan periods ───────────────────────────────────────────

/**
 * Computes the loan due date as `start + duration_days - 1` (inclusive).
 * Returns ISO date string YYYY-MM-DD.
 */
export function computeLoanDueDate(startDate: string, durationDays: number): string {
  const start = new Date(startDate + 'T00:00:00');
  const due = new Date(start);
  due.setDate(due.getDate() + durationDays - 1);
  return formatDateYMD(due);
}

/** Format a Date as YYYY-MM-DD (local time, no UTC shift). */
export function formatDateYMD(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
