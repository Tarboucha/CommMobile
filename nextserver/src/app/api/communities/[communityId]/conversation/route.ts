import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, ApiErrors } from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/communities/:communityId/conversation
 * Get the community's group conversation.
 * Returns the conversation if the user is an active member.
 */
export const GET = withAuth(
  async (user, _request: NextRequest, params) => {
    const { communityId } = params!;
    const supabase = await createClient();

    // Verify the user is an active member
    const { data: membership, error: memberError } = await supabase
      .from("community_members")
      .select("profile_id")
      .eq("community_id", communityId)
      .eq("profile_id", user.id)
      .eq("membership_status", "active")
      .maybeSingle();

    if (memberError) {
      console.error("Error checking membership:", memberError);
      return ApiErrors.serverError();
    }

    if (!membership) {
      return ApiErrors.notCommunityMember();
    }

    // Get the community conversation
    const { data: conversation, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("community_id", communityId)
      .eq("conversation_type", "community")
      .maybeSingle();

    if (error) {
      console.error("Error fetching conversation:", error);
      return ApiErrors.serverError();
    }

    if (!conversation) {
      return ApiErrors.notFound("Conversation");
    }

    return successResponse({ conversation });
  }
);
