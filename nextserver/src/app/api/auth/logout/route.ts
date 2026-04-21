import { ApiErrors, successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response"
import { NextRequest } from "next/server"
import { log } from "@/lib/log"

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://auth-service:3004'

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization")
    if (!authHeader) {
      return ApiErrors.unauthorized("No authorization header")
    }

    const res = await fetch(`${AUTH_SERVICE_URL}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: authHeader },
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      return ApiErrors.unauthorized(body.message || 'Logout failed')
    }

    return successResponse({ message: "Successfully logged out" }, "Logged out successfully")
  } catch (err) {
    log.error({ err }, "unexpected error during logout")
    return ApiErrors.serverError("An unexpected error occurred during logout")
  }
}

export async function GET() {
  return handleUnsupportedMethod(["POST"])
}

export async function PUT() {
  return handleUnsupportedMethod(["POST"])
}

export async function DELETE() {
  return handleUnsupportedMethod(["POST"])
}

export async function PATCH() {
  return handleUnsupportedMethod(["POST"])
}
