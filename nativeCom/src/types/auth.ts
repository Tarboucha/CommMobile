import { Profile } from "@/types/profile";
import type { Address } from "@/types/address";

// Re-export for convenience
export type { Profile };

// User type — profile with addresses
export type User = Profile & {
  addresses: Address[] | null;
};

// ============================================================================
// Auth Service Types
// ============================================================================

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface SignUpCredentials {
  email: string;
  password: string;
  confirmPassword: string;
}

export interface LoginResult {
  success: boolean;
  error?: LoginError;
  profile?: User;
}

export interface SignUpResult {
  success: boolean;
  error?: SignUpError;
  requiresEmailVerification?: boolean;
}

export type LoginError =
  | { type: 'validation'; message: string }
  | { type: 'invalid_credentials'; message: string }
  | { type: 'email_not_confirmed'; message: string }
  | { type: 'account_suspended'; message: string }
  | { type: 'session_failed'; message: string }
  | { type: 'unknown'; message: string };

export type SignUpError =
  | { type: 'validation'; message: string }
  | { type: 'email_exists'; message: string }
  | { type: 'weak_password'; message: string }
  | { type: 'unknown'; message: string };
