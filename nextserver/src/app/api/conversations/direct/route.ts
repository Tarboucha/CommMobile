import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { createDirectConversationSchema } from "@/lib/validations/conversation";

/**
 * POST /api/conversations/direct
 * Find or create a direct conversation between the authenticated user and another user.
 */
export const POST = withAuth(async (user, request: NextRequest) => {
  const supabase = await createClient();

  // Parse body
  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = createDirectConversationSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { other_profile_id } = validation.data;

  // Cannot DM yourself
  if (other_profile_id === user.id) {
    return ApiErrors.badRequest("Cannot create a conversation with yourself");
  }

  // Verify other profile exists
  const { data: otherProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", other_profile_id)
    .single();

  if (!otherProfile) {
    return ApiErrors.notFound("Profile");
  }

  // Find existing direct conversation between the two users
  // Step 1: Get current user's active direct conversations
  const { data: myParticipations } = await supabase
    .from("conversation_participants")
    .select("conversation_id, conversations!inner(id, conversation_type)")
    .eq("profile_id", user.id)
    .eq("conversations.conversation_type", "direct")
    .is("left_at", null)
    .is("removed_at", null);

  const myConvoIds = (myParticipations || []).map((p: any) => p.conversation_id);

  if (myConvoIds.length > 0) {
    // Step 2: Check if the other user is also a participant in any of those
    const { data: match } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("profile_id", other_profile_id)
      .in("conversation_id", myConvoIds)
      .is("left_at", null)
      .is("removed_at", null)
      .limit(1)
      .maybeSingle();

    if (match) {
      // Return existing conversation
      const { data: conversation } = await supabase
        .from("conversations")
        .select("*")
        .eq("id", match.conversation_id)
        .single();

      if (conversation) {
        return successResponse({ conversation });
      }
    }
  }

  // Create new direct conversation
  const { data: conversation, error: createError } = await supabase
    .from("conversations")
    .insert({
      conversation_type: "direct" as const,
      created_by_profile_id: user.id,
    })
    .select("*")
    .single();

  if (createError || !conversation) {
    console.error("Failed to create direct conversation:", createError);
    return ApiErrors.serverError();
  }

  // Add both users as participants
  const { error: participantError } = await supabase
    .from("conversation_participants")
    .insert([
      { conversation_id: conversation.id, profile_id: user.id },
      { conversation_id: conversation.id, profile_id: other_profile_id },
    ]);

  if (participantError) {
    console.error("Failed to add conversation participants:", participantError);
  }

  return successResponse({ conversation }, undefined, 201);
});

export async function GET() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["POST"]);
}
