import { z } from "zod";

/**
 * Profile Validation Schemas
 * Validates profile fields for the unified profile model
 */

/**
 * Base Profile Schema - Core profile fields
 */
export const baseProfileSchema = z.object({
  first_name: z.string().min(1, "First name is required").max(100),
  last_name: z.string().min(1, "Last name is required").max(100),
  display_name: z.string().max(200).optional().nullable().or(z.literal("")),
  bio: z.string().max(1000).optional().nullable().or(z.literal("")),
  phone: z
    .string()
    .regex(/^\+?[0-9]\d{1,14}$/, "Invalid phone number format")
    .optional()
    .nullable()
    .or(z.literal("")),
  preferred_language: z.string().max(10).optional().nullable().or(z.literal("")),
  avatar_url: z.string().optional().nullable().or(z.literal("")),
});

/**
 * Profile Update Schema - All fields optional for partial updates
 */
export const profileUpdateSchema = baseProfileSchema.partial();

/**
 * Type exports derived from schemas
 */
export type BaseProfileInput = z.infer<typeof baseProfileSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
