import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { memberFilterSchema } from "@/lib/validations/community";
import {
  applyCursorPagination,
  buildPaginatedResponse,
} from "@/lib/utils/pagination";
import type { CommunityMemberResponse } from "@/types/community";

/**
 * GET /api/communities/[communityId]/members
 * List community members — RLS: only active members can see others
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

  const validation = memberFilterSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { membership_status, limit, after } = validation.data;

  let query = supabase
    .from("community_members")
    .select("*")
    .eq("community_id", communityId);

  if (membership_status) {
    query = query.eq("membership_status", membership_status);
  } else {
    query = query.eq("membership_status", "active");
  }

  query = applyCursorPagination(query, { limit, after });

  const { data: members, error } = await query;

  if (error) {
    console.error("Error fetching members:", error);
    return ApiErrors.serverError();
  }

  return successResponse(buildPaginatedResponse(members || [], limit));
});

/**
 * POST /api/communities/[communityId]/members
 * Join or request to join a community
 */
export const POST = withAuth(async (user, _request, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const supabase = await createClient();

  // Fetch community
  const { data: community, error: communityError } = await supabase
    .from("communities")
    .select("id, access_type, is_active, deleted_at, current_members_count, max_members, auto_approve_join_requests")
    .eq("id", communityId)
    .is("deleted_at", null)
    .eq("is_active", true)
    .single();

  if (communityError || !community) {
    return ApiErrors.notFound("Community not found");
  }

  // Invite-only communities can't be joined directly
  if (community.access_type === "invite_only") {
    return ApiErrors.forbidden(
      "This community is invite-only. You need an invitation to join."
    );
  }

  // Check not already a member
  const { data: existing } = await supabase
    .from("community_members")
    .select("id, membership_status")
    .eq("community_id", communityId)
    .eq("profile_id", user.id)
    .single();

  if (existing) {
    if (existing.membership_status === "active") {
      return ApiErrors.alreadyExists("You are already a member of this community");
    }
    if (existing.membership_status === "pending") {
      return ApiErrors.alreadyExists("You already have a pending join request");
    }
  }

  // Check capacity
  if (
    community.max_members &&
    (community.current_members_count || 0) >= community.max_members
  ) {
    return ApiErrors.conflict("This community has reached its maximum member capacity");
  }

  // Determine status based on access_type
  const isOpen =
    community.access_type === "open" || community.auto_approve_join_requests;
  const membershipStatus = isOpen ? "active" : "pending";

  const now = new Date().toISOString();

  // If user previously left/was removed, update instead of insert
  if (existing && (existing.membership_status === "left" || existing.membership_status === "removed")) {
    const { data: member, error } = await supabase
      .from("community_members")
      .update({
        join_method: "request" as const,
        membership_status: membershipStatus as "active" | "pending",
        join_requested_at: now,
        membership_approved_at: isOpen ? now : null,
        removal_reason: null,
        removed_by_profile_id: null,
        membership_removed_at: null,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error || !member) {
      console.error("Error rejoining community:", error);
      return ApiErrors.serverError();
    }

    return successResponse<CommunityMemberResponse>(
      { member },
      isOpen ? "Joined community" : "Join request submitted",
      isOpen ? 200 : 201
    );
  }

  const { data: member, error } = await supabase
    .from("community_members")
    .insert({
      community_id: communityId,
      profile_id: user.id,
      join_method: "request" as const,
      membership_status: membershipStatus as "active" | "pending",
      join_requested_at: now,
      membership_approved_at: isOpen ? now : null,
    })
    .select()
    .single();

  if (error || !member) {
    console.error("Error joining community:", error);
    return ApiErrors.serverError();
  }

  return successResponse<CommunityMemberResponse>(
    { member },
    isOpen ? "Joined community" : "Join request submitted",
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
