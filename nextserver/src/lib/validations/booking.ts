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

export const bookingItemSchema = z
  .object({
    offering_id: z.string().uuid(),
    offering_version: z.number().int().positive(),
    quantity: z.number().int().min(1).max(99),
    fulfillment_method: z.enum(fulfillmentMethodValues),
    schedule_id: z.string().uuid().nullable(),
    instance_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD")
      .nullable(),
    special_instructions: z.string().max(500).optional(),
  })
  .refine(
    (d) => (d.schedule_id === null) === (d.instance_date === null),
    {
      message: "schedule_id and instance_date must both be provided or both null",
      path: ["schedule_id"],
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
  ]),
  cancellation_reason: z.string().max(500).optional(),
});

// ============================================================================
// Type exports
// ============================================================================

export type BookingItemInput = z.infer<typeof bookingItemSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type BookingStatusUpdateInput = z.infer<typeof bookingStatusUpdateSchema>;
