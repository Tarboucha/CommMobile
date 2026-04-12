import { z } from "zod";

// ============================================================================
// Enum values
// ============================================================================

export const paymentMethodValues = ["cash", "external"] as const;

export const fulfillmentMethodValues = [
  "pickup",
  "delivery",
  "online",
  "at_location",
] as const;

// ============================================================================
// Booking Item Schema
// ============================================================================

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

export const bookingItemSchema = z
  .object({
    offering_id: z.string().uuid(),
    offering_version: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
    fulfillment_method: z.enum(fulfillmentMethodValues),
    schedule_id: z.string().uuid().nullable(),
    instance_date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD").nullable(),
    special_instructions: z.string().max(500).optional(),
    // Time-slotted fields (optional, only set for services with slot_duration_minutes)
    instance_start_time: z.string().regex(timeRegex, "Time must be HH:MM").optional().nullable(),
    instance_end_time: z.string().regex(timeRegex, "Time must be HH:MM").optional().nullable(),
    // Loan-specific fields (optional, only set when offering is a loan)
    is_loan: z.boolean().optional(),
    loan_start_date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD").optional(),
    loan_due_date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD").optional(),
    deposit_amount: z.number().nonnegative().optional(),
  })
  .refine(
    (d) => (d.schedule_id === null) === (d.instance_date === null),
    {
      message: "schedule_id and instance_date must both be provided or both null",
      path: ["schedule_id"],
    }
  )
  .refine(
    (d) => {
      const hasStart = !!d.instance_start_time;
      const hasEnd = !!d.instance_end_time;
      return hasStart === hasEnd;
    },
    {
      message: "instance_start_time and instance_end_time must both be provided or both null",
      path: ["instance_start_time"],
    }
  )
  .refine(
    (d) => !d.is_loan || (d.loan_start_date && d.loan_due_date),
    {
      message: "Loan items require loan_start_date and loan_due_date",
      path: ["loan_start_date"],
    }
  )
  .refine(
    (d) => !d.is_loan || !d.loan_start_date || !d.loan_due_date || d.loan_due_date >= d.loan_start_date,
    {
      message: "loan_due_date must be on or after loan_start_date",
      path: ["loan_due_date"],
    }
  );

// ============================================================================
// Booking Create Schema
// ============================================================================

export const bookingCreateSchema = z.object({
  community_id: z.string().uuid(),
  items: z.array(bookingItemSchema).min(1, "At least one item required").max(50),
  payment_method: z.enum(paymentMethodValues),
  delivery_address_id: z.string().uuid().optional().nullable(),
  special_instructions: z.string().max(1000).optional(),
  contact_phone: z.string().max(30).optional(),
  idempotency_key: z.string().uuid(),
  // Optional: make an offer instead of booking at listed price
  offer_amount: z.number().positive().optional(),
  offer_note: z.string().max(500).optional(),
});

// ============================================================================
// Booking Status Update Schema
// ============================================================================

export const bookingStatusUpdateSchema = z.object({
  booking_status: z.enum([
    "confirmed",
    "in_progress",
    "ready",
    "completed",
    "cancelled",
    "loaned_out",
  ]),
  cancellation_reason: z.string().max(500).optional(),
});

// ============================================================================
// Type exports
// ============================================================================

export type BookingItemInput = z.infer<typeof bookingItemSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingStatusUpdateInput = z.infer<typeof bookingStatusUpdateSchema>;
