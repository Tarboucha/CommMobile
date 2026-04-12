import type { profiles, Prisma } from "@/generated/prisma/client";

/**
 * Profile types extracted from the Prisma schema.
 */

// ============================================================================
// Profile Types (profiles table)
// ============================================================================

export type Profile = profiles;
export type ProfileInsert = Prisma.profilesCreateInput;
export type ProfileUpdate = Prisma.profilesUpdateInput;
