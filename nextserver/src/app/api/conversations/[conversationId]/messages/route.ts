import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { sendMessageSchema, messageQuerySchema } from "@/lib/validations/message";
import {
  applyCursorPagination,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";

/**
 * Verify the user is an active participant in the conversation.
 * Returns true if participant, false otherwise.
 */
async function isActiveParticipant(
  supabase: Awaited<ReturnType<typeof createClient>>,
  conversationId: string,
  profileId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", profileId)
    .is("left_at", null)
    .is("removed_at", null)
    .maybeSingle();

  return !!data;
}

/**
 * GET /api/conversations/:conversationId/messages
 * Paginated message history for any conversation type (booking or direct).
 * Requires participant membership.
 */
export const GET = withAuth(
  async (user, request: NextRequest, params) => {
    const { conversationId } = params!;
    const supabase = await createClient();

    // Verify participant
    if (!(await isActiveParticipant(supabase, conversationId, user.id))) {
      return ApiErrors.notConversationParticipant();
    }

    // Parse query params
    const searchParams = Object.fromEntries(
      new URL(request.url).searchParams.entries()
    );

    const validation = messageQuerySchema.safeParse(searchParams);
    if (!validation.success) {
      return ApiErrors.validationError(parseZodError(validation.error));
    }

    const { limit, after } = validation.data;

    // Query messages with sender profile
    let query = supabase
      .from("messages")
      .select(
        "*, sender:profiles!sender_id(id, display_name, first_name, last_name, avatar_url)"
      )
      .eq("conversation_id", conversationId)
      .eq("is_deleted", false);

    query = applyCursorPagination(query, { limit, after });

    const { data: messages, error } = await query;

    if (error) {
      console.error("Error fetching messages:", error);
      return ApiErrors.serverError();
    }

    return successResponse(buildPaginatedResponse(messages || [], limit));
  }
);

/**
 * POST /api/conversations/:conversationId/messages
 * Send a message to any conversation (booking or direct).
 * Requires participant membership. DB trigger handles real-time broadcast.
 */
export const POST = withAuth(
  async (user, request: NextRequest, params) => {
    const { conversationId } = params!;
    const supabase = await createClient();

    // Verify participant
    if (!(await isActiveParticipant(supabase, conversationId, user.id))) {
      return ApiErrors.notConversationParticipant();
    }

    // Parse body
    let rawData: Record<string, unknown>;
    try {
      rawData = await request.json();
    } catch {
      return ApiErrors.badRequest("Invalid JSON in request body");
    }

    const validation = sendMessageSchema.safeParse(rawData);
    if (!validation.success) {
      return ApiErrors.validationError(parseZodError(validation.error));
    }

    // Insert message
    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: validation.data.content,
      })
      .select(
        "*, sender:profiles!sender_id(id, display_name, first_name, last_name, avatar_url)"
      )
      .single();

    if (error) {
      console.error("Error sending message:", error);
      return ApiErrors.serverError();
    }

    return successResponse({ message }, undefined, 201);
  }
);

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "POST"]);
}
