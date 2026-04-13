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
export const GET = withSecureAuth(async (user, _request: NextRequest) => {
  return successResponse({ profile: user });
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

