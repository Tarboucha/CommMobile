import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";

/**
 * GET /api/profiles
 * Get current authenticated user's profile
 */
export const GET = withAuth(async (user, _request: NextRequest) => {
  return successResponse({
    profile: user,
  });
});

// Catch unsupported methods
export async function POST() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET"]);
}

