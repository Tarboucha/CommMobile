import { z } from "zod";
import type { AddressUpdate } from "@/types/address";

/**
 * Address Validation Schemas
 * Validates AddressUpdate type fields
 */

/**
 * Helper to normalize empty strings to null for nullable fields
 */
const normalizeEmptyToNull = (val: string | null | undefined): string | null | undefined => {
  return val === "" ? null : val;
};

/**
 * Address Schema - Full schema for creating addresses
 * Required: street_name, city, postal_code, country, address_type, profile_id, latitude, longitude
 * Optional: street_number, state, apartment_unit, label, delivery_instructions, is_default, is_active
 * 
 * Note: latitude and longitude are required because geocoding always provides them
 * Note: street_number is optional as some countries (e.g., Tunisia) may not have street numbers in Nominatim
 */
export const addressSchema = z.object({
  street_number: z.string().max(20).optional().nullable().or(z.literal("")).transform(normalizeEmptyToNull),
  street_name: z.string().min(1, "Street name is required").max(200),
  apartment_unit: z.string().max(50).optional().nullable().or(z.literal("")).transform(normalizeEmptyToNull),
  city: z.string().min(1, "City is required").max(100),
  state: z.string().max(100).optional().or(z.literal("")).transform((val) => val === "" ? undefined : val),
  postal_code: z.string().min(1, "Postal code is required").max(20),
  country: z.string().min(1, "Country is required").max(100),
  address_type: z.enum(["home", "work", "other"]),
  label: z.string().max(100).optional().nullable().or(z.literal("")).transform(normalizeEmptyToNull),
  delivery_instructions: z.string().max(500).optional().nullable().or(z.literal("")).transform(normalizeEmptyToNull),
  latitude: z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
  longitude: z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180"),
  is_default: z.boolean().optional(),
  is_active: z.boolean().optional(),
  visibility: z.enum(["private", "offering_pickup"]).optional().default("private"),
  profile_id: z.uuid("Invalid profile ID format"),
}) satisfies z.ZodType<Partial<AddressUpdate>>;

/**
 * Address Update Schema - Partial schema for PATCH operations
 * All fields are optional for updates
 */
export const addressUpdateSchema = addressSchema.partial() satisfies z.ZodType<Partial<AddressUpdate>>;

/**
 * Type exports derived from schemas
 */
export type AddressInput = z.infer<typeof addressSchema>;
export type AddressUpdateInput = z.infer<typeof addressUpdateSchema>;

