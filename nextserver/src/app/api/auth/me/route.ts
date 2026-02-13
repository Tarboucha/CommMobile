import { NextRequest } from "next/server"
import { ApiErrors, successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response"
import { withSecureAuth } from "@/lib/utils/api-route-helper"

/**
 * GET /api/auth/me
 * Get current authenticated user's profile
 * Returns the user profile with addresses
 *
 * Uses withSecureAuth (getUser) for mobile JWT validation with Authorization header
 */
export const GET = withSecureAuth(async (user, request: NextRequest) => {
  // Debug: Log Authorization header to verify it's being received
  const authHeader = request.headers.get('authorization');
  console.log('[/api/auth/me] Authorization header:', authHeader ? `Present (${authHeader.substring(0, 20)}...)` : 'MISSING');

  // The user object from withSecureAuth already contains profile with addresses
  return successResponse({
    profile: user,
  })
})

// Catch unsupported methods
export async function POST() {
  return handleUnsupportedMethod(["GET"])
}

export async function PUT() {
  return handleUnsupportedMethod(["GET"])
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET"])
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET"])
}

