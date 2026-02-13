import { z } from "zod";
import type { ContactInquiryInsert } from "@/types/contact-inquiry";

/**
 * Contact Inquiry Validation Schemas
 * Validates ContactInquiryInsert type fields
 */

/**
 * Inquiry subject enum values
 */
const inquirySubjectEnum = z.enum([
  "general_question",
  "marketing",
  "become_chef",
  "support",
  "partnership",
  "complaint",
  "other",
]);

/**
 * Contact Inquiry Schema - For creating new contact inquiries
 * Note: id, created_at, updated_at are server-managed and not included in schema
 * Note: status defaults to "new" in database, not included in schema
 */
export const contactInquirySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(100, "Name must be less than 100 characters")
    .trim(),
  email: z
    .string()
    .email("Invalid email address")
    .transform((s) => s.trim().toLowerCase()),
  message: z
    .string()
    .min(10, "Message must be at least 10 characters")
    .max(1000, "Message must be less than 1000 characters")
    .trim(),
  subject: inquirySubjectEnum,
}) satisfies z.ZodType<Pick<ContactInquiryInsert, "name" | "email" | "message" | "subject">>;

/**
 * Contact Inquiry Input Type
 * Extracted from validation schema
 */
export type ContactInquiryInput = z.infer<typeof contactInquirySchema>;

