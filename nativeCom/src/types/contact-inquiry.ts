import { Database } from "@/types/supabase";

/**
 * Contact Inquiry Types
 * Extracted from Supabase schema
 */

// ============================================================================
// Database Types (from Supabase)
// ============================================================================

/**
 * Contact inquiry row type from database
 */
export type ContactInquiry = Database["public"]["Tables"]["contact_inquiries"]["Row"];

/**
 * Contact inquiry insert type for creating new records
 */
export type ContactInquiryInsert = Database["public"]["Tables"]["contact_inquiries"]["Insert"];

/**
 * Contact inquiry update type for updating existing records
 */
export type ContactInquiryUpdate = Database["public"]["Tables"]["contact_inquiries"]["Update"];

/**
 * Inquiry status enum type
 */
export type InquiryStatus = Database["public"]["Enums"]["inquiry_status"];

/**
 * Inquiry subject enum type
 */
export type InquirySubject = Database["public"]["Enums"]["inquiry_subject"];

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Contact inquiry API response structure
 */
export interface ContactInquiryResponse {
  inquiry: ContactInquiry;
}

/**
 * Contact inquiry list API response structure
 * (For future admin interface)
 */
export interface ContactInquiryListResponse {
  inquiries: ContactInquiry[];
  total?: number;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Inquiry subject enum values
 */
export const INQUIRY_SUBJECTS = [
  "general_question",
  "marketing",
  "become_chef",
  "support",
  "partnership",
  "complaint",
  "other",
] as const;

/**
 * Inquiry status enum values
 */
export const INQUIRY_STATUSES = [
  "new",
  "read",
  "resolved",
  "archived",
] as const;

/**
 * User-friendly labels for inquiry subjects
 */
export const INQUIRY_SUBJECT_LABELS: Record<InquirySubject, string> = {
  general_question: "General Question",
  marketing: "Marketing",
  become_chef: "Become a Chef",
  support: "Support",
  partnership: "Partnership",
  complaint: "Complaint",
  other: "Other",
};

