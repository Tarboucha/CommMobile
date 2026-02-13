import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { createInvitationSchema } from "@/lib/validations/community";
import {
  applyCursorPagination,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";
import { paginationSchema } from "@/lib/validations/pagination";
import type { CommunityInvitationResponse } from "@/types/community";

/**
 * GET /api/communities/[communityId]/invitations
 * List invitations — admin/owner sees all, invitee sees own (via RLS)
 */
export const GET = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();
  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = paginationSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { limit, after } = validation.data;

  let query = supabase
    .from("community_invitations")
    .select("*")
    .eq("community_id", communityId);

  query = applyCursorPagination(query, { limit, after });

  const { data: invitations, error } = await query;

  if (error) {
    console.error("Error fetching invitations:", error);
    return ApiErrors.serverError();
  }

  return successResponse(buildPaginatedResponse(invitations || [], limit));
});

/**
 * POST /api/communities/[communityId]/invitations
 * Create an invitation — requires invite permission
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  // Check user has invite permission
  const { data: membership } = await supabase
    .from("community_members")
    .select("member_role, can_invite_members")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .eq("membership_status", "active")
    .single();

  if (!membership) {
    return ApiErrors.forbidden("You are not a member of this community");
  }

  const hasPermission =
    membership.can_invite_members ||
    ["owner", "admin", "moderator"].includes(membership.member_role || "");

  if (!hasPermission) {
    return ApiErrors.forbidden("You don't have permission to invite members");
  }

  let rawData: Record<string, any>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = createInvitationSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const input = validation.data;

  // Calculate expires_at
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + input.expires_in_days);

  const { data: invitation, error } = await supabase
    .from("community_invitations")
    .insert({
      community_id: communityId,
      invited_by_profile_id: user.id,
      invited_profile_id: input.invited_profile_id ?? null,
      invited_email: input.invited_email ?? null,
      invitation_message: input.invitation_message ?? null,
      invitation_token: randomUUID(),
      max_uses: input.max_uses,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error || !invitation) {
    console.error("Error creating invitation:", error);
    return ApiErrors.serverError();
  }

  return successResponse<CommunityInvitationResponse>(
    { invitation },
    undefined,
    201
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
