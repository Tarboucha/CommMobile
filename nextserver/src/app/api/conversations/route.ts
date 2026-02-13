import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { conversationsListQuerySchema } from "@/lib/validations/conversation";

/**
 * GET /api/conversations
 * List the authenticated user's conversations (direct and/or booking).
 * Optional ?type=direct|booking filter.
 * Returns conversations with other participants' profile info and unread status.
 */
export const GET = withAuth(async (user, request: NextRequest) => {
  const supabase = await createClient();

  // Parse query params
  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = conversationsListQuerySchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { type } = validation.data;

  // Get user's active conversations with conversation details
  let query = supabase
    .from("conversation_participants")
    .select(`
      conversation_id,
      last_read_at,
      is_muted,
      conversations!inner(
        id, conversation_type, booking_id, community_id,
        title, last_message_at, last_message_preview, created_at
      )
    `)
    .eq("profile_id", user.id)
    .is("left_at", null)
    .is("removed_at", null);

  if (type) {
    query = query.eq("conversations.conversation_type", type);
  } else {
    // Default: exclude community (community chat has its own route)
    query = query.in("conversations.conversation_type", ["direct", "booking"]);
  }

  const { data: participations, error } = await query.order(
    "conversations(last_message_at)",
    { ascending: false, nullsFirst: false }
  );

  if (error) {
    console.error("Error fetching conversations:", error);
    return ApiErrors.serverError();
  }

  if (!participations || participations.length === 0) {
    return successResponse({ conversations: [] });
  }

  // Get conversation IDs for fetching other participants
  const conversationIds = participations.map((p: any) => p.conversation_id);

  // Fetch other participants' profiles
  const { data: otherParticipants } = await supabase
    .from("conversation_participants")
    .select(
      "conversation_id, profile:profiles!profile_id(id, display_name, first_name, last_name, avatar_url)"
    )
    .in("conversation_id", conversationIds)
    .neq("profile_id", user.id)
    .is("left_at", null)
    .is("removed_at", null);

  // Group participants by conversation
  const participantsByConvo = new Map<string, any[]>();
  for (const p of otherParticipants || []) {
    const existing = participantsByConvo.get(p.conversation_id) || [];
    if (p.profile) existing.push(p.profile);
    participantsByConvo.set(p.conversation_id, existing);
  }

  // Build response
  const conversations = participations.map((p: any) => {
    const convo = p.conversations;
    return {
      id: convo.id,
      conversation_type: convo.conversation_type,
      booking_id: convo.booking_id,
      community_id: convo.community_id,
      title: convo.title,
      last_message_at: convo.last_message_at,
      last_message_preview: convo.last_message_preview,
      created_at: convo.created_at,
      last_read_at: p.last_read_at,
      is_muted: p.is_muted,
      participants: participantsByConvo.get(p.conversation_id) || [],
    };
  });

  return successResponse({ conversations });
});

export async function POST() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET"]);
}
