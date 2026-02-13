import { createClient } from "@/lib/supabase/server"
import { ApiErrors, successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response"
import { NextRequest } from "next/server"

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createClient()

    // Sign out (idempotent - safe to call even if not logged in)
    const { error: signOutError } = await supabase.auth.signOut()

    if (signOutError) {
      // If already logged out, that's fine
      const errorMsg = signOutError.message.toLowerCase()
      if (errorMsg.includes("session") || errorMsg.includes("no session")) {
        return successResponse({ message: "No active session" }, "Already logged out")
      }
      console.error("Logout error:", signOutError.message)
      return ApiErrors.serverError("Failed to sign out")
    }

    return successResponse({ message: "Successfully logged out" }, "Logged out successfully")
  } catch (error) {
    console.error("Unexpected error during logout:", error)
    return ApiErrors.serverError("An unexpected error occurred during logout")
  }
}

// Catch unsupported methods
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