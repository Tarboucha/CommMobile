import { fetchAPI } from '@/lib/api/client';
import type { User } from '@/types/auth';

/**
 * Fetch the current authenticated user's profile
 */
export async function fetchMe() {
  return fetchAPI<{
    success: boolean;
    data: {
      profile: User;
      requiresOnboarding?: boolean;
      requiresProfileCompletion?: boolean;
    };
  }>('/api/auth/me');
}

/**
 * Logout the current user on the server
 */
export async function logoutServer() {
  return fetchAPI('/api/auth/logout', { method: 'POST' });
}
