import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { sendMessageSchema, messageQuerySchema } from "@/lib/validations/message";
import {
  applyCursorPagination,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";

/**
 * GET /api/communities/:communityId/conversation/messages
 * Paginated message history (newest first).
 * Includes sender profile info.
 */
export const GET = withAuth(
  async (user, request: NextRequest, params) => {
    const { communityId } = params!;
    const supabase = await createClient();

    // Verify membership
    const { data: membership } = await supabase
      .from("community_members")
      .select("profile_id")
      .eq("community_id", communityId)
      .eq("profile_id", user.id)
      .eq("membership_status", "active")
      .maybeSingle();

    if (!membership) {
      return ApiErrors.notCommunityMember();
    }

    // Get the conversation ID
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("community_id", communityId)
      .eq("conversation_type", "community")
      .maybeSingle();

    if (!conversation) {
      return ApiErrors.notFound("Conversation");
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
      .eq("conversation_id", conversation.id)
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
 * POST /api/communities/:communityId/conversation/messages
 * Send a message to the community chat.
 */
export const POST = withAuth(
  async (user, request: NextRequest, params) => {
    const { communityId } = params!;
    const supabase = await createClient();

    // Verify membership
    const { data: membership } = await supabase
      .from("community_members")
      .select("profile_id")
      .eq("community_id", communityId)
      .eq("profile_id", user.id)
      .eq("membership_status", "active")
      .maybeSingle();

    if (!membership) {
      return ApiErrors.notCommunityMember();
    }

    // Get the conversation ID
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id")
      .eq("community_id", communityId)
      .eq("conversation_type", "community")
      .maybeSingle();

    if (!conversation) {
      return ApiErrors.notFound("Conversation");
    }

    // Parse body
    let rawData: Record<string, any>;
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
        conversation_id: conversation.id,
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
