import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth/verify";
import { prisma } from "@/lib/prisma";
import { ApiErrors } from "@/lib/utils/api-response";
import { runWithRequestContext, getRequestId, getRequestDuration } from "@/lib/request-context";
import { log } from "@/lib/log";
import { httpRequestsTotal, httpRequestDuration, normalizeRoute } from "@/lib/metrics";
import { User } from "@/types/auth";

/**
 * Record one RED-style sample for the given request/response pair. Route is
 * normalized to its template form to keep Prometheus label cardinality bounded.
 */
function recordMetrics(
  request: NextRequest,
  status: number,
  durationMs: number,
) {
  const method = request.method
  const route = normalizeRoute(request.nextUrl.pathname)
  const statusLabel = String(status)
  httpRequestsTotal.inc({ method, route, status: statusLabel })
  httpRequestDuration.observe({ method, route, status: statusLabel }, durationMs / 1000)
}

/**
 * Handler function type that receives the authenticated user, request, and optional params
 */
type AuthenticatedHandler<TParams = Record<string, string>> = (
  user: User,
  request: NextRequest,
  params?: TParams
) => Promise<NextResponse> | NextResponse;

function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.substring(7);
}

/**
 * Fetch profile with addresses for authenticated user.
 * sub = profile ID directly (no auth_user_id → profile_id lookup needed).
 */
async function fetchUserProfile(profileId: string): Promise<User | null> {
  const profile = await prisma.profiles.findUnique({
    where: { id: profileId },
    include: {
      addresses: {
        where: { deleted_at: null },
      },
    },
  });

  if (!profile) return null;

  return { ...profile, addresses: profile.addresses || null } as unknown as User;
}

/**
 * Authenticate request: verify JWT via JWKS, then fetch profile via Prisma.
 * sub in JWT = profile ID directly — single DB query, no Supabase round-trip.
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<User> {
  const token = extractBearerToken(request);
  if (!token) throw new Error("UNAUTHORIZED");

  let claims;
  try {
    claims = await verifyToken(token);
  } catch {
    throw new Error("UNAUTHORIZED");
  }

  if (!claims.sub) throw new Error("UNAUTHORIZED");

  const user = await fetchUserProfile(claims.sub);
  if (!user) throw new Error("UNAUTHORIZED");

  return user;
}

/**
 * Secure auth uses the same local JWT verification.
 * With short-lived access tokens (1h) + refresh token rotation,
 * local JWKS verification is sufficient — no server round-trip needed.
 */
export async function getAuthenticatedUserSecure(request: NextRequest): Promise<User> {
  return getAuthenticatedUser(request);
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

        const durationMs = getRequestDuration();
        log.info({
          reqId: rid,
          userId: user.id,
          req: { method: request.method, url: request.nextUrl.pathname },
          res: { statusCode: response.status },
          responseTime: durationMs,
        }, "request completed");
        recordMetrics(request, response.status, durationMs);

        return attachRequestId(response);
      } catch (error: any) {
        const durationMs = getRequestDuration();
        if (error.message === "UNAUTHORIZED") {
          const response = ApiErrors.unauthorized();
          recordMetrics(request, response.status, durationMs);
          return attachRequestId(response);
        }

        log.error({
          reqId: rid,
          err: error,
          req: { method: request.method, url: request.nextUrl.pathname },
          responseTime: durationMs,
        }, "request failed");

        const response = ApiErrors.serverError();
        recordMetrics(request, response.status, durationMs);
        return attachRequestId(response);
      }
    });
  };
}

/**
 * Secure authentication wrapper for sensitive operations.
 * With our own auth service (short-lived JWTs + JWKS), both wrappers
 * use the same local verification — no server round-trip needed.
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

        const durationMs = getRequestDuration();
        log.info({
          reqId: rid,
          userId: user.id,
          req: { method: request.method, url: request.nextUrl.pathname },
          res: { statusCode: response.status },
          responseTime: durationMs,
          secure: true,
        }, "request completed");
        recordMetrics(request, response.status, durationMs);

        return attachRequestId(response);
      } catch (error: any) {
        const durationMs = getRequestDuration();
        if (error.message === "UNAUTHORIZED") {
          const response = ApiErrors.unauthorized();
          recordMetrics(request, response.status, durationMs);
          return attachRequestId(response);
        }

        log.error({
          reqId: rid,
          err: error,
          req: { method: request.method, url: request.nextUrl.pathname },
          responseTime: durationMs,
          secure: true,
        }, "request failed");

        const response = ApiErrors.serverError();
        recordMetrics(request, response.status, durationMs);
        return attachRequestId(response);
      }
    });
  };
}

/**
 * Wrapper for public (unauthenticated) API routes so their requests are still
 * recorded by RED metrics. Mirrors withAuth's lifecycle minus JWT verification.
 */
type PublicHandler<TParams = Record<string, string>> = (
  request: NextRequest,
  params?: TParams,
) => Promise<NextResponse> | NextResponse;

export function withMetrics<TParams = Record<string, string>>(
  handler: PublicHandler<TParams>,
) {
  return async (
    request: NextRequest,
    context?: { params: Promise<TParams> },
  ): Promise<NextResponse> => {
    return runWithRequestContext(async () => {
      const rid = getRequestId();

      try {
        let params: TParams | undefined;
        if (context?.params) params = await context.params;

        const response = await handler(request, params);

        const durationMs = getRequestDuration();
        log.info({
          reqId: rid,
          req: { method: request.method, url: request.nextUrl.pathname },
          res: { statusCode: response.status },
          responseTime: durationMs,
        }, "request completed");
        recordMetrics(request, response.status, durationMs);

        return attachRequestId(response);
      } catch (error: any) {
        const durationMs = getRequestDuration();
        log.error({
          reqId: rid,
          err: error,
          req: { method: request.method, url: request.nextUrl.pathname },
          responseTime: durationMs,
        }, "request failed");

        const response = ApiErrors.serverError();
        recordMetrics(request, response.status, durationMs);
        return attachRequestId(response);
      }
    });
  };
}
