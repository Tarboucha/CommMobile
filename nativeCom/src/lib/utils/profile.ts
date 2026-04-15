import type { User } from "@/types/auth";
import { fetchMe } from "@/lib/api/auth";

/**
 * Get profile with addresses for authenticated user.
 * Uses the kodo-api /auth/me endpoint instead of direct DB query.
 */
export async function getProfileWithRelations(): Promise<User | null> {
  try {
    const result = await fetchMe();
    if (result.success && result.data?.profile) {
      return result.data.profile as User;
    }
    return null;
  } catch {
    return null;
  }
}
