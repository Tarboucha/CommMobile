import { z } from "zod";

/**
 * Base Profile Validation Schema
 * Validates profile fields for create/update
 */
export const baseProfileSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  phone: z
    .string()
    .regex(/^\+?[0-9]\d{1,14}$/, "Invalid phone number format")
    .optional()
    .nullable()
    .or(z.literal("")),
  avatar_url: z.string().optional().nullable().or(z.literal("")),
});

/**
 * Partial schema for updating existing profiles (all fields optional)
 */
export const profileUpdatePartialSchema = baseProfileSchema.partial();

/**
 * Type exports derived from schemas
 */
export type BaseProfileInput = z.infer<typeof baseProfileSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdatePartialSchema>;
