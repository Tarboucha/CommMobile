import * as SecureStore from 'expo-secure-store';
import {
  GoogleSignin,
  isSuccessResponse,
  statusCodes,
} from '@react-native-google-signin/google-signin';
import { fetchMe } from '@/lib/api/auth';
import { ApiClientError } from '@/lib/api/client';
import type {
  LoginCredentials,
  SignUpCredentials,
  LoginResult,
  SignUpResult,
  LoginError,
  SignUpError,
} from '@/types/auth';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL || 'http://localhost:3004';

// ============================================================================
// Validation
// ============================================================================

export function validateLoginCredentials(credentials: LoginCredentials): LoginError | null {
  if (!credentials.email || !credentials.password) {
    return { type: 'validation', message: 'Please enter both email and password' };
  }
  return null;
}

export function validateSignUpCredentials(credentials: SignUpCredentials): SignUpError | null {
  if (!credentials.email || !credentials.password || !credentials.confirmPassword) {
    return { type: 'validation', message: 'Please fill in all fields' };
  }

  if (credentials.password !== credentials.confirmPassword) {
    return { type: 'validation', message: 'Passwords do not match' };
  }

  if (credentials.password.length < 6) {
    return { type: 'weak_password', message: 'Password must be at least 6 characters' };
  }

  return null;
}

// ============================================================================
// Login Service
// ============================================================================

/**
 * Login with email and password
 *
 * Flow:
 * 1. Authenticate with auth-service (get JWT tokens)
 * 2. Store tokens in SecureStore
 * 3. Validate with backend (check business rules: banned, onboarding, etc.)
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  const validationError = validateLoginCredentials(credentials);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    // STEP 1: Login with auth-service
    const res = await fetch(`${AUTH_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email.trim(),
        password: credentials.password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 401) {
        return {
          success: false,
          error: { type: 'invalid_credentials', message: 'Incorrect email or password' },
        };
      }
      return {
        success: false,
        error: { type: 'unknown', message: data.message || 'Login failed' },
      };
    }

    // STEP 2: Store tokens
    await SecureStore.setItemAsync('access_token', data.access_token);
    await SecureStore.setItemAsync('refresh_token', data.refresh_token);

    // STEP 3: Validate with backend (business rules)
    try {
      const response = await fetchMe();
      const { profile, requiresOnboarding, requiresProfileCompletion } = response.data;

      return {
        success: true,
        profile,
        requiresOnboarding,
        requiresProfileCompletion,
      };
    } catch (backendError) {
      // Backend rejected user — clear tokens
      await clearTokens();

      if (backendError instanceof ApiClientError) {
        if (backendError.status === 403) {
          return {
            success: false,
            error: {
              type: 'account_suspended',
              message: 'Your account has been suspended. Please contact support for assistance.',
            },
          };
        }

        if (backendError.status === 402) {
          return {
            success: false,
            error: {
              type: 'payment_required',
              message: 'Please add a payment method to continue.',
            },
          };
        }
      }

      return {
        success: false,
        error: {
          type: 'unknown',
          message: 'There was a problem accessing your account. Please try again later.',
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      error: { type: 'unknown', message: error instanceof Error ? error.message : 'An unexpected error occurred' },
    };
  }
}

// ============================================================================
// Google Sign-In Service
// ============================================================================

/**
 * Sign in with Google.
 *
 * Flow:
 * 1. Open native Google account picker, get ID token
 * 2. POST to auth-service /auth/google, get KoDo access+refresh tokens
 * 3. Store KoDo tokens in SecureStore
 * 4. Validate with backend (business rules: suspended, onboarding, etc.)
 *
 * User cancellations are surfaced as a non-error success=false result so
 * the caller can distinguish "silent dismiss" from real failures.
 */
export async function loginWithGoogle(): Promise<LoginResult> {
  let idToken: string;
  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (!isSuccessResponse(response)) {
      // User dismissed the picker — treat as silent no-op, not an error.
      return {
        success: false,
        error: { type: 'validation', message: 'Sign-in cancelled' },
      };
    }

    const token = response.data.idToken;
    if (!token) {
      return {
        success: false,
        error: { type: 'unknown', message: 'No ID token returned from Google' },
      };
    }
    idToken = token;
  } catch (err: any) {
    if (err?.code === statusCodes.SIGN_IN_CANCELLED) {
      return {
        success: false,
        error: { type: 'validation', message: 'Sign-in cancelled' },
      };
    }
    return {
      success: false,
      error: {
        type: 'unknown',
        message: err instanceof Error ? err.message : 'Google sign-in failed',
      },
    };
  }

  try {
    const res = await fetch(`${AUTH_URL}/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: idToken }),
    });

    const data = await res.json();

    if (!res.ok) {
      return {
        success: false,
        error: {
          type: res.status === 401 ? 'invalid_credentials' : 'unknown',
          message: data.message || 'Google sign-in was rejected',
        },
      };
    }

    await SecureStore.setItemAsync('access_token', data.access_token);
    await SecureStore.setItemAsync('refresh_token', data.refresh_token);

    try {
      const response = await fetchMe();
      const { profile } = response.data;
      return { success: true, profile };
    } catch (backendError) {
      await clearTokens();
      if (backendError instanceof ApiClientError && backendError.status === 403) {
        return {
          success: false,
          error: {
            type: 'account_suspended',
            message:
              'Your account has been suspended. Please contact support for assistance.',
          },
        };
      }
      return {
        success: false,
        error: {
          type: 'unknown',
          message:
            'There was a problem accessing your account. Please try again later.',
        },
      };
    }
  } catch (error) {
    return {
      success: false,
      error: {
        type: 'unknown',
        message:
          error instanceof Error ? error.message : 'An unexpected error occurred',
      },
    };
  }
}

// ============================================================================
// Sign Up Service
// ============================================================================

export async function signUp(credentials: SignUpCredentials): Promise<SignUpResult> {
  const validationError = validateSignUpCredentials(credentials);
  if (validationError) {
    return { success: false, error: validationError };
  }

  try {
    const res = await fetch(`${AUTH_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: credentials.email.trim(),
        password: credentials.password,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      if (res.status === 409) {
        return {
          success: false,
          error: { type: 'email_exists', message: 'An account with this email already exists' },
        };
      }
      return {
        success: false,
        error: { type: 'unknown', message: data.message || 'Failed to create account' },
      };
    }

    return {
      success: true,
      requiresEmailVerification: true,
    };
  } catch (error) {
    return {
      success: false,
      error: { type: 'unknown', message: error instanceof Error ? error.message : 'An unexpected error occurred' },
    };
  }
}

// ============================================================================
// Logout Service
// ============================================================================

export async function logout(): Promise<void> {
  try {
    const token = await SecureStore.getItemAsync('access_token');
    if (token) {
      await fetch(`${AUTH_URL}/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }
  } catch {
    // Best effort — clear tokens even if server call fails
  }
  await clearTokens();
}

// ============================================================================
// Token Helpers
// ============================================================================

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync('access_token');
  await SecureStore.deleteItemAsync('refresh_token');
}
