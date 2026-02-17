import { z } from "zod";
import { paginationSchema } from "@/lib/validations/pagination";

// ============================================================================
// Enum values
// ============================================================================

export const offeringCategoryValues = [
  "product",
  "service",
  "share",
  "event",
] as const;

export const priceTypeValues = [
  "fixed",
  "negotiable",
  "free",
  "donation",
] as const;

export const fulfillmentMethodValues = [
  "pickup",
  "delivery",
  "online",
  "at_location",
] as const;

// ============================================================================
// Offering Schemas
// ============================================================================

export const createOfferingSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    description: z.string().max(2000).optional(),
    category: z.enum(offeringCategoryValues),
    price_type: z.enum(priceTypeValues).default("fixed"),
    price_amount: z.number().min(0).optional(),
    currency_code: z.string().max(3).default("EUR"),
    fulfillment_method: z.enum(fulfillmentMethodValues).default("pickup"),
    pickup_address_id: z.string().uuid().optional().nullable(),
    is_delivery_available: z.boolean().default(false),
    delivery_fee_amount: z.number().min(0).optional(),
    delivery_radius_km: z.number().min(0).optional(),
  })
  .refine(
    (data) => {
      if (data.price_type === "fixed" && (data.price_amount === undefined || data.price_amount <= 0)) {
        return false;
      }
      return true;
    },
    { message: "Price amount is required for fixed pricing", path: ["price_amount"] }
  );

export const updateOfferingSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  category: z.enum(offeringCategoryValues).optional(),
  price_type: z.enum(priceTypeValues).optional(),
  price_amount: z.number().min(0).optional(),
  fulfillment_method: z.enum(fulfillmentMethodValues).optional(),
  pickup_address_id: z.string().uuid().optional().nullable(),
  is_delivery_available: z.boolean().optional(),
  delivery_fee_amount: z.number().min(0).optional(),
  delivery_radius_km: z.number().min(0).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

export const offeringFilterSchema = paginationSchema.extend({
  category: z.enum(offeringCategoryValues).optional(),
});

// ============================================================================
// Schedule Schemas
// ============================================================================

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const createScheduleSchema = z
  .object({
    rrule: z.string().min(1, "Recurrence rule is required"),
    dtstart: z.string().regex(dateRegex, "Start date must be YYYY-MM-DD"),
    dtend: z.string().regex(dateRegex, "End date must be YYYY-MM-DD").optional().nullable(),
    start_time: z.string().regex(timeRegex, "Start time must be HH:MM"),
    end_time: z.string().regex(timeRegex, "End time must be HH:MM"),
    slots_available: z.number().int().min(1, "At least 1 slot required"),
    slot_label: z.string().max(100).optional(),
    is_active: z.boolean().default(true),
  })
  .refine(
    (data) => data.end_time > data.start_time,
    { message: "End time must be after start time", path: ["end_time"] }
  )
  .refine(
    (data) => {
      if (data.dtend) return data.dtend >= data.dtstart;
      return true;
    },
    { message: "End date must be on or after start date", path: ["dtend"] }
  );

export const updateScheduleSchema = z
  .object({
    rrule: z.string().min(1).optional(),
    dtstart: z.string().regex(dateRegex).optional(),
    dtend: z.string().regex(dateRegex).optional().nullable(),
    start_time: z.string().regex(timeRegex).optional(),
    end_time: z.string().regex(timeRegex).optional(),
    slots_available: z.number().int().min(1).optional(),
    slot_label: z.string().max(100).optional().nullable(),
    is_active: z.boolean().optional(),
  });

// ============================================================================
// Type exports
// ============================================================================

export type CreateOfferingInput = z.infer<typeof createOfferingSchema>;
export type UpdateOfferingInput = z.infer<typeof updateOfferingSchema>;
export type OfferingFilterInput = z.infer<typeof offeringFilterSchema>;
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;
