import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
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

  const community = await prisma.communities.findFirst({
    where: { invite_link_token: token, is_active: true },
    select: {
      id: true, community_name: true, community_description: true,
      current_members_count: true, max_members: true, access_type: true,
      invite_link_expires_at: true,
    },
  });

  if (!community) {
    return ApiErrors.notFound("Invite link");
  }

  if (community.invite_link_expires_at) {
    if (new Date(community.invite_link_expires_at) < new Date()) {
      return ApiErrors.badRequest("This invite link has expired");
    }
  }

  const membership = await prisma.community_members.findFirst({
    where: {
      community_id: community.id,
      profile_id: user.id,
      membership_status: "active",
    },
    select: { id: true },
  });

  const { invite_link_expires_at, ...communityData } = community;

  return successResponse({
    community: communityData,
    is_already_member: !!membership,
  });
});

/**
 * POST /api/invite/[token]
 * Accept an invite link — join the community
 * Uses a SECURITY DEFINER function (kept as Supabase RPC)
 */
export const POST = withAuth(async (user, _request: NextRequest, params) => {
  const token = params?.token;
  if (!token) {
    return ApiErrors.badRequest("Invite token is required");
  }

  // Keep Supabase for RPC call
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
