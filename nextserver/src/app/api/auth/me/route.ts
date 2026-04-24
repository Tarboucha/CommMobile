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
  // Onboarding = Pflichtfelder; Mobile-Client routet in den onboarding-Screen
  // wenn true. Heute reichen first_name + last_name; später ggfs. erweitern.
  const requiresOnboarding = !user.first_name || !user.last_name;
  return successResponse({ profile: user, requiresOnboarding });
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

