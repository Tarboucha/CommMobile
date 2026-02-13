import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/communities/[communityId]/leave
 * Leave a community — sets membership_status to 'left'
 * Owner cannot leave (must transfer ownership first)
 */
export const POST = withAuth(async (user, _request, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  // Fetch user's membership
  const { data: membership, error: fetchError } = await supabase
    .from("community_members")
    .select("id, member_role, membership_status")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .single();

  if (fetchError || !membership) {
    return ApiErrors.notFound("You are not a member of this community");
  }

  if (membership.membership_status !== "active") {
    return ApiErrors.conflict("You are not an active member of this community");
  }

  // Owner can't leave
  if (membership.member_role === "owner") {
    return ApiErrors.forbidden(
      "The owner cannot leave the community. Transfer ownership first."
    );
  }

  const { error } = await supabase
    .from("community_members")
    .update({
      membership_status: "left",
      membership_removed_at: new Date().toISOString(),
    })
    .eq("id", membership.id);

  if (error) {
    console.error("Error leaving community:", error);
    return ApiErrors.serverError();
  }

  return successResponse({ message: "You have left the community" });
});

export async function GET() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["POST"]);
}
