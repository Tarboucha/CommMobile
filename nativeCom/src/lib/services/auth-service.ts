import { supabase } from '@/lib/supabase/client';
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

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate login credentials
 */
export function validateLoginCredentials(credentials: LoginCredentials): LoginError | null {
  if (!credentials.email || !credentials.password) {
    return { type: 'validation', message: 'Please enter both email and password' };
  }
  return null;
}

/**
 * Validate signup credentials
 */
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
 * 1. Authenticate with Supabase (get JWT tokens)
 * 2. Validate with backend (check business rules: banned, onboarding, etc.)
 */
export async function login(credentials: LoginCredentials): Promise<LoginResult> {
  // Validate credentials
  const validationError = validateLoginCredentials(credentials);
  if (validationError) {
    return { success: false, error: validationError };
  }


  try {
    // STEP 1: Login with Supabase directly
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email.trim(),
      password: credentials.password,
    });


    if (error) {
      // Handle specific Supabase auth errors
      if (error.message.includes('Invalid login credentials')) {
        return {
          success: false,
          error: { type: 'invalid_credentials', message: 'Incorrect email or password' },
        };
      }
      if (error.message.includes('Email not confirmed')) {
        return {
          success: false,
          error: {
            type: 'email_not_confirmed',
            message: 'Please check your email and confirm your account before logging in.',
          },
        };
      }
      return {
        success: false,
        error: { type: 'unknown', message: error.message },
      };
    }

    if (!data.session) {
      return {
        success: false,
        error: { type: 'session_failed', message: 'Failed to establish session' },
      };
    }


    // STEP 2: Validate with backend (business rules)

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
      // Backend rejected user - logout
      await supabase.auth.signOut();

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
// Sign Up Service
// ============================================================================

/**
 * Sign up with email and password
 */
export async function signUp(credentials: SignUpCredentials): Promise<SignUpResult> {
  // Validate credentials
  const validationError = validateSignUpCredentials(credentials);
  if (validationError) {
    return { success: false, error: validationError };
  }


  try {
    const { data, error } = await supabase.auth.signUp({
      email: credentials.email.trim(),
      password: credentials.password,
    });

    if (error) {
      // Handle specific Supabase auth errors
      if (error.message.includes('already registered')) {
        return {
          success: false,
          error: { type: 'email_exists', message: 'An account with this email already exists' },
        };
      }
      return {
        success: false,
        error: { type: 'unknown', message: error.message },
      };
    }

    if (data.user) {

      return {
        success: true,
        requiresEmailVerification: true,
      };
    }

    return {
      success: false,
      error: { type: 'unknown', message: 'Failed to create account' },
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

/**
 * Logout current user
 */
export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}
