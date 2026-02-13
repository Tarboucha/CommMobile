// API client for mobile app - Token-based authentication
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase/client';
import { withRetry } from '@/lib/utils/retry';
import { type FetchAPIOptions, type RetryOptions, ApiClientError } from '@/types/api';

// Re-export for backward compatibility
export { ApiClientError };

const isDev = __DEV__;
const API_URL = isDev
  ? Constants.expoConfig?.extra?.apiUrl || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3002'
  : Constants.expoConfig?.extra?.apiUrlProd || process.env.EXPO_PUBLIC_API_URL_PROD || 'https://api.kodo.app';


// ============================================================================
// Cached token via onAuthStateChange
// ============================================================================

let cachedAccessToken: string | null = null;

supabase.auth.onAuthStateChange((_event, session) => {
  cachedAccessToken = session?.access_token ?? null;
});

export interface ApiError {
  message: string;
  status: number;
  details?: unknown;
}

interface ApiErrorResponse {
  error?: { message?: string; details?: unknown };
  message?: string;
  details?: unknown;
}

function buildApiError(errorData: ApiErrorResponse, status: number, statusText: string): ApiClientError {
  const message =
    errorData.error?.message ||
    errorData.message ||
    `API Error: ${statusText}`;
  const details = errorData.error?.details || errorData.details || errorData;
  return new ApiClientError(message, status, details);
}

/**
 * Get the current access token.
 * Uses the cached token from onAuthStateChange when available,
 * falls back to getSession() if cache is not yet populated.
 */
async function getAccessToken(): Promise<string> {
  if (cachedAccessToken) {
    return cachedAccessToken;
  }

  // Fallback: cache not yet populated (e.g. first call before onAuthStateChange fires)
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    throw new ApiClientError('Not authenticated', 401);
  }
  cachedAccessToken = session.access_token;
  return session.access_token;
}

/**
 * Make authenticated API request with automatic token refresh and retry
 *
 * @param endpoint - API endpoint (e.g., '/api/users')
 * @param options - Fetch options with optional retry configuration
 * @returns Response data
 *
 * @example
 * ```ts
 * // Default retry (3 attempts with exponential backoff)
 * const data = await fetchAPI('/api/data');
 *
 * // Custom retry config
 * const data = await fetchAPI('/api/data', {
 *   retry: { maxRetries: 5, baseDelayMs: 500 }
 * });
 *
 * // Disable retry
 * const data = await fetchAPI('/api/auth/login', { retry: false });
 * ```
 */
export async function fetchAPI<T = any>(
  endpoint: string,
  options?: FetchAPIOptions
): Promise<T> {
  const { retry = true, ...fetchOptions } = options ?? {};

  // The actual fetch operation
  const doFetch = async (): Promise<T> => {
    try {
      const token = await getAccessToken();
      const url = `${API_URL}${endpoint}`;

      const response = await fetch(url, {
        ...fetchOptions,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...fetchOptions?.headers,
        },
      });

      // Handle 401 - Token might be expired/invalid (not retried by withRetry)
      if (response.status === 401) {
        const { data: { session: newSession }, error: refreshError } =
          await supabase.auth.refreshSession();

        if (refreshError || !newSession) {
          cachedAccessToken = null;
          await supabase.auth.signOut();
          throw new ApiClientError('Session expired, please login again', 401);
        }

        // Retry with new token
        const retryResponse = await fetch(url, {
          ...fetchOptions,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${newSession.access_token}`,
            ...fetchOptions?.headers,
          },
        });

        if (!retryResponse.ok) {
          const errorData = await retryResponse.json().catch(() => ({}));
          throw buildApiError(errorData, retryResponse.status, retryResponse.statusText);
        }

        return await retryResponse.json();
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw buildApiError(errorData, response.status, response.statusText);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiClientError) {
        throw error;
      }
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Network error',
        0,
        error
      );
    }
  };

  // Apply retry logic if enabled
  if (retry) {
    const retryOptions: RetryOptions = typeof retry === 'object' ? retry : {};
    return withRetry(doFetch, retryOptions);
  }

  return doFetch();
}

/**
 * Make authenticated FormData upload with retry support
 * (no Content-Type header — browser sets boundary)
 */
export async function uploadAPI<T = any>(
  endpoint: string,
  formData: FormData,
  method: 'POST' | 'PUT' | 'PATCH' = 'POST',
  retryConfig: boolean | RetryOptions = true
): Promise<T> {
  const doUpload = async (): Promise<T> => {
    try {
      const token = await getAccessToken();
      const url = `${API_URL}${endpoint}`;

      const response = await fetch(url, {
        method,
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw buildApiError(errorData, response.status, response.statusText);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      throw new ApiClientError(
        error instanceof Error ? error.message : 'Upload error',
        0,
        error
      );
    }
  };

  // Apply retry logic if enabled
  if (retryConfig) {
    const retryOptions: RetryOptions = typeof retryConfig === 'object' ? retryConfig : {};
    return withRetry(doUpload, retryOptions);
  }

  return doUpload();
}

// Convenience methods
export const apiClient = {
  get: <T = unknown>(endpoint: string) =>
    fetchAPI<T>(endpoint, { method: 'GET' }),

  post: <T = unknown>(endpoint: string, body: unknown) =>
    fetchAPI<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  put: <T = unknown>(endpoint: string, body: unknown) =>
    fetchAPI<T>(endpoint, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),

  patch: <T = unknown>(endpoint: string, body: unknown) =>
    fetchAPI<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: <T = unknown>(endpoint: string) =>
    fetchAPI<T>(endpoint, { method: 'DELETE' }),
};

export { API_URL };
