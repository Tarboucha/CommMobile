import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import { ApiErrors } from "@/lib/utils/api-response";
import { User } from "@/types/auth";

/**
 * Handler function type that receives the authenticated user, request, and optional params
 * Supports both static routes and dynamic routes with params
 */
type AuthenticatedHandler<TParams = Record<string, string>> = (
  user: User,
  request: NextRequest,
  params?: TParams
) => Promise<NextResponse> | NextResponse;

/**
 * Fetch profile with addresses for authenticated user
 */
async function fetchUserProfile(
  supabase: ReturnType<typeof createClientFromRequest>,
  authUserId: string
): Promise<User | null> {
  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .single();

  if (profileError || !profile) {
    return null;
  }

  // Fetch addresses
  const { data: addresses } = await supabase
    .from("addresses")
    .select("*")
    .eq("profile_id", profile.id)
    .is("deleted_at", null)
    .order("is_default", { ascending: false });

  return {
    ...profile,
    addresses: addresses || null,
  } as User;
}

/**
 * Get authenticated user from Supabase session
 * Uses getClaims() for fast local JWT verification
 *
 * @throws Error("UNAUTHORIZED") if not authenticated
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<User> {
  // Extract Bearer token from request
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  if (!bearerToken) {
    throw new Error("UNAUTHORIZED");
  }

  const supabase = createClientFromRequest(request);

  // Verify JWT using getClaims (fast, local verification)
  const { data, error: claimsError } = await supabase.auth.getClaims(bearerToken);

  if (claimsError || !data?.claims?.sub) {
    throw new Error("UNAUTHORIZED");
  }

  // Extract user ID from claims
  const authUserId = data.claims.sub;

  // Fetch user profile
  const user = await fetchUserProfile(supabase, authUserId);

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

/**
 * Get authenticated user with server-side verification
 * Uses getUser() to verify session with Auth server
 * Slower but ensures session hasn't been revoked
 *
 * Use for: Bookings, Payments, Critical operations
 *
 * @throws Error("UNAUTHORIZED") if not authenticated
 */
export async function getAuthenticatedUserSecure(request: NextRequest): Promise<User> {
  const supabase = createClientFromRequest(request);

  // Verify session with Auth server
  const {
    data: { user: authUser },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !authUser) {
    throw new Error("UNAUTHORIZED");
  }

  // Fetch user profile
  const user = await fetchUserProfile(supabase, authUser.id);

  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  return user;
}

/**
 * Wrapper for API routes that require authentication
 *
 * Handles:
 * - User authentication
 * - Dynamic route params extraction
 * - Error catching and formatting
 *
 * @example Static route
 * ```ts
 * export const GET = withAuth(async (user, request) => {
 *   // user is authenticated
 * });
 * ```
 *
 * @example Dynamic route
 * ```ts
 * export const GET = withAuth(async (user, request, params) => {
 *   const { id } = params;
 * });
 * ```
 */
export function withAuth<TParams = Record<string, string>>(
  handler: AuthenticatedHandler<TParams>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<TParams> }
  ): Promise<NextResponse> => {
    try {
      // Get authenticated user
      const user = await getAuthenticatedUser(request);

      // Extract params if dynamic route
      let params: TParams | undefined;
      if (context?.params) {
        params = await context.params;
      }

      // Call handler
      return await handler(user, request, params);
    } catch (error: any) {
      if (error.message === "UNAUTHORIZED") {
        return ApiErrors.unauthorized();
      }

      console.error("[API Route Error]", {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error.message,
      });

      return ApiErrors.serverError();
    }
  };
}

/**
 * Secure authentication wrapper for sensitive operations
 * Uses getUser() to verify session with Auth server
 *
 * Use for: Bookings, Payments, Critical operations
 */
export function withSecureAuth<TParams = Record<string, string>>(
  handler: AuthenticatedHandler<TParams>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<TParams> }
  ): Promise<NextResponse> => {
    try {
      // Use secure authentication
      const user = await getAuthenticatedUserSecure(request);

      // Extract params if dynamic route
      let params: TParams | undefined;
      if (context?.params) {
        params = await context.params;
      }

      // Call handler
      return await handler(user, request, params);
    } catch (error: any) {
      if (error.message === "UNAUTHORIZED") {
        return ApiErrors.unauthorized();
      }

      console.error("[API Route Error]", {
        path: request.nextUrl.pathname,
        method: request.method,
        error: error.message,
      });

      return ApiErrors.serverError();
    }
  };
}
