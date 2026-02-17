import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/invite/[token]
 * Resolve an invite link token — returns community info + membership status
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  const token = params?.token;
  if (!token) {
    return ApiErrors.badRequest("Invite token is required");
  }

  const supabase = await createClient();

  // Look up community by invite link token
  const { data: community, error } = await supabase
    .from("communities")
    .select("id, community_name, community_description, current_members_count, max_members, access_type")
    .eq("invite_link_token", token)
    .eq("is_active", true)
    .single();

  if (error || !community) {
    return ApiErrors.notFound("Invite link");
  }

  // Check if token is expired
  const { data: fullCommunity } = await supabase
    .from("communities")
    .select("invite_link_expires_at")
    .eq("id", community.id)
    .single();

  if (fullCommunity?.invite_link_expires_at) {
    const expiresAt = new Date(fullCommunity.invite_link_expires_at);
    if (expiresAt < new Date()) {
      return ApiErrors.badRequest("This invite link has expired");
    }
  }

  // Check if user is already a member
  const { data: membership } = await supabase
    .from("community_members")
    .select("id, membership_status")
    .eq("community_id", community.id)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .single();

  return successResponse({
    community,
    is_already_member: !!membership,
  });
});

/**
 * POST /api/invite/[token]
 * Accept an invite link — join the community
 * Uses a SECURITY DEFINER function to bypass RLS safely
 * (the function validates the token server-side before inserting)
 */
export const POST = withAuth(async (user, _request: NextRequest, params) => {
  const token = params?.token;
  if (!token) {
    return ApiErrors.badRequest("Invite token is required");
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc("join_community_via_invite_link", {
    p_token: token,
  });

  if (error) {
    console.error("Error calling join_community_via_invite_link:", error);
    return ApiErrors.serverError();
  }

  const result = data as { success?: boolean; already_member?: boolean; member_id?: string; error?: string };

  if (result.error) {
    return ApiErrors.badRequest(result.error);
  }

  return successResponse(
    { member: { id: result.member_id }, already_member: result.already_member ?? false },
    undefined,
    result.already_member ? 200 : 201
  );
});

export async function PUT() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "POST"]);
}
