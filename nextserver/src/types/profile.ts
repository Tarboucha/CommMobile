import { Database } from "@/types/supabase";

/**
 * Profile types extracted from Supabase schema
 */

// ============================================================================
// Profile Types (profiles table)
// ============================================================================

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type ProfileInsert = Database["public"]["Tables"]["profiles"]["Insert"];
export type ProfileUpdate = Database["public"]["Tables"]["profiles"]["Update"];
