import { NextRequest, NextResponse } from "next/server";
import { createClientFromRequest } from "@/lib/supabase/server";
import { ApiErrors } from "@/lib/utils/api-response";
import { runWithRequestContext, getRequestId, getRequestDuration } from "@/lib/request-context";
import { User } from "@/types/auth";

/**
 * Handler function type that receives the authenticated user, request, and optional params
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
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("auth_user_id", authUserId)
    .single();

  if (profileError || !profile) return null;

  const { data: addresses } = await supabase
    .from("addresses")
    .select("*")
    .eq("profile_id", profile.id)
    .is("deleted_at", null)
    .order("is_default", { ascending: false });

  return { ...profile, addresses: addresses || null } as User;
}

/**
 * Fast auth: JWT claims verification (local, no server round-trip)
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<User> {
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

  if (!bearerToken) throw new Error("UNAUTHORIZED");

  const supabase = createClientFromRequest(request);
  const { data, error: claimsError } = await supabase.auth.getClaims(bearerToken);

  if (claimsError || !data?.claims?.sub) throw new Error("UNAUTHORIZED");

  const user = await fetchUserProfile(supabase, data.claims.sub);
  if (!user) throw new Error("UNAUTHORIZED");

  return user;
}

/**
 * Secure auth: server-verified session (slower, ensures session not revoked)
 * Use for: bookings, payments, critical mutations
 */
export async function getAuthenticatedUserSecure(request: NextRequest): Promise<User> {
  const supabase = createClientFromRequest(request);
  const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();

  if (userError || !authUser) throw new Error("UNAUTHORIZED");

  const user = await fetchUserProfile(supabase, authUser.id);
  if (!user) throw new Error("UNAUTHORIZED");

  return user;
}

/**
 * Attach the request ID header to a response.
 */
function attachRequestId(response: NextResponse): NextResponse {
  response.headers.set("X-Request-Id", getRequestId());
  return response;
}

/**
 * Wrapper for API routes that require authentication.
 * Provides: request ID tracking, auth, params extraction, error handling, duration logging.
 */
export function withAuth<TParams = Record<string, string>>(
  handler: AuthenticatedHandler<TParams>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<TParams> }
  ): Promise<NextResponse> => {
    return runWithRequestContext(async () => {
      const rid = getRequestId();

      try {
        const user = await getAuthenticatedUser(request);

        let params: TParams | undefined;
        if (context?.params) params = await context.params;

        const response = await handler(user, request, params);

        console.log(`[${rid}] ${request.method} ${request.nextUrl.pathname} → ${response.status} (${getRequestDuration()}ms) user=${user.id}`);

        return attachRequestId(response);
      } catch (error: any) {
        if (error.message === "UNAUTHORIZED") {
          return attachRequestId(ApiErrors.unauthorized());
        }

        console.error(`[${rid}] ${request.method} ${request.nextUrl.pathname} → 500 (${getRequestDuration()}ms)`, {
          error: error.message,
        });

        return attachRequestId(ApiErrors.serverError());
      }
    });
  };
}

/**
 * Secure authentication wrapper for sensitive operations.
 * Uses getUser() to verify session with Auth server.
 */
export function withSecureAuth<TParams = Record<string, string>>(
  handler: AuthenticatedHandler<TParams>
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<TParams> }
  ): Promise<NextResponse> => {
    return runWithRequestContext(async () => {
      const rid = getRequestId();

      try {
        const user = await getAuthenticatedUserSecure(request);

        let params: TParams | undefined;
        if (context?.params) params = await context.params;

        const response = await handler(user, request, params);

        console.log(`[${rid}] ${request.method} ${request.nextUrl.pathname} → ${response.status} (${getRequestDuration()}ms) user=${user.id}`);

        return attachRequestId(response);
      } catch (error: any) {
        if (error.message === "UNAUTHORIZED") {
          return attachRequestId(ApiErrors.unauthorized());
        }

        console.error(`[${rid}] ${request.method} ${request.nextUrl.pathname} → 500 (${getRequestDuration()}ms)`, {
          error: error.message,
        });

        return attachRequestId(ApiErrors.serverError());
      }
    });
  };
}
