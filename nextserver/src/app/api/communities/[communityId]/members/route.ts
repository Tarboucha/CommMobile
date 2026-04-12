import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { memberFilterSchema } from "@/lib/validations/community";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";
import type { CommunityMemberResponse } from "@/types/community";

/**
 * GET /api/communities/[communityId]/members
 * List community members
 */
export const GET = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = memberFilterSchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { membership_status, limit, after } = validation.data;

  try {
    const where: any = { community_id: communityId };
    where.membership_status = membership_status || "active";

    if (after) {
      const cursor = decodeCursor(after);
      if (cursor) {
        where.OR = [
          { created_at: { lt: new Date(cursor.created_at) } },
          { created_at: { equals: new Date(cursor.created_at) }, id: { lt: cursor.id } },
        ];
      }
    }

    const members = await prisma.community_members.findMany({
      where,
      include: {
        profiles_community_members_profile_idToprofiles: {
          select: { id: true, first_name: true, last_name: true, avatar_url: true },
        },
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    // Reshape relation name to match existing API contract
    const shaped = members.map((m) => {
      const { profiles_community_members_profile_idToprofiles, ...rest } = m;
      return { ...rest, profiles: profiles_community_members_profile_idToprofiles, created_at: rest.created_at?.toISOString() ?? null };
    });

    return successResponse(buildPaginatedResponse(shaped as any, limit));
  } catch (error) {
    console.error("Error fetching members:", error);
    return ApiErrors.serverError();
  }
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

  try {
    const community = await prisma.communities.findFirst({
      where: { id: communityId, deleted_at: null, is_active: true },
      select: { id: true, access_type: true, is_active: true, current_members_count: true, max_members: true, auto_approve_join_requests: true },
    });

    if (!community) {
      return ApiErrors.notFound("Community not found");
    }

    if (community.access_type === "invite_only") {
      return ApiErrors.forbidden("This community is invite-only. You need an invitation to join.");
    }

    const existing = await prisma.community_members.findFirst({
      where: { community_id: communityId, profile_id: user.id },
      select: { id: true, membership_status: true },
    });

    if (existing) {
      if (existing.membership_status === "active") {
        return ApiErrors.alreadyExists("You are already a member of this community");
      }
      if (existing.membership_status === "pending") {
        return ApiErrors.alreadyExists("You already have a pending join request");
      }
    }

    if (community.max_members && (community.current_members_count || 0) >= community.max_members) {
      return ApiErrors.conflict("This community has reached its maximum member capacity");
    }

    const isOpen = community.access_type === "open" || community.auto_approve_join_requests;
    const membershipStatus = isOpen ? "active" : "pending";
    const now = new Date();

    if (existing && (existing.membership_status === "left" || existing.membership_status === "removed")) {
      const member = await prisma.community_members.update({
        where: { id: existing.id },
        data: {
          join_method: "request",
          membership_status: membershipStatus,
          join_requested_at: now,
          membership_approved_at: isOpen ? now : null,
          removal_reason: null,
          removed_by_profile_id: null,
          membership_removed_at: null,
        },
      });

      return successResponse<CommunityMemberResponse>(
        { member: member as any },
        isOpen ? "Joined community" : "Join request submitted",
        isOpen ? 200 : 201
      );
    }

    const member = await prisma.community_members.create({
      data: {
        community_id: communityId,
        profile_id: user.id,
        join_method: "request",
        membership_status: membershipStatus,
        join_requested_at: now,
        membership_approved_at: isOpen ? now : null,
      },
    });

    return successResponse<CommunityMemberResponse>(
      { member: member as any },
      isOpen ? "Joined community" : "Join request submitted",
      201
    );
  } catch (error) {
    console.error("Error joining community:", error);
    return ApiErrors.serverError();
  }
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
