import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/communities/[communityId]/invite-link
 * Generate or refresh the community invite link (admin/owner/moderator only)
 */
export const POST = withAuth(async (user, _request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  // Check user has admin/owner/moderator role
  const { data: membership } = await supabase
    .from("community_members")
    .select("member_role")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .single();

  if (!membership) {
    return ApiErrors.forbidden("You are not a member of this community");
  }

  if (!["owner", "admin", "moderator"].includes(membership.member_role || "")) {
    return ApiErrors.forbidden("You don't have permission to manage invite links");
  }

  // Generate token and set expiry (7 days)
  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const { error } = await supabase
    .from("communities")
    .update({
      invite_link_token: token,
      invite_link_expires_at: expiresAt.toISOString(),
    })
    .eq("id", communityId);

  if (error) {
    console.error("Error generating invite link:", error);
    return ApiErrors.serverError();
  }

  return successResponse(
    { token, expires_at: expiresAt.toISOString() },
    undefined,
    201
  );
});

/**
 * DELETE /api/communities/[communityId]/invite-link
 * Revoke the community invite link (admin/owner/moderator only)
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  // Check user has admin/owner/moderator role
  const { data: membership } = await supabase
    .from("community_members")
    .select("member_role")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .single();

  if (!membership) {
    return ApiErrors.forbidden("You are not a member of this community");
  }

  if (!["owner", "admin", "moderator"].includes(membership.member_role || "")) {
    return ApiErrors.forbidden("You don't have permission to manage invite links");
  }

  const { error } = await supabase
    .from("communities")
    .update({
      invite_link_token: null,
      invite_link_expires_at: null,
    })
    .eq("id", communityId);

  if (error) {
    console.error("Error revoking invite link:", error);
    return ApiErrors.serverError();
  }

  return successResponse({ message: "Invite link revoked" });
});

export async function GET() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["POST", "DELETE"]);
}
