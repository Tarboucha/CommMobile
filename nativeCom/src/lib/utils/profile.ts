import type { User } from "@/types/auth";
import type { Address } from "@/types/address";
import { supabase } from "@/lib/supabase/client";

/**
 * Get profile with addresses for authenticated user
 * Queries the profiles table and joins addresses
 */
export async function getProfileWithRelations(
  authUserId: string
): Promise<User | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*, addresses(*)")
    .eq("auth_user_id", authUserId)
    .single();

  if (error || !data) {
    return null;
  }

  const addresses: Address[] = Array.isArray(data.addresses)
    ? data.addresses
    : [];

  return {
    ...data,
    addresses,
  };
}
