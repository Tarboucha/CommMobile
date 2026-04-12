import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { updateCommunitySchema } from "@/lib/validations/community";
import type { CommunityResponse } from "@/types/community";

/**
 * GET /api/communities/[communityId]
 * Get a single community
 */
export const GET = withAuth(async (user, _request, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const community = await prisma.communities.findFirst({
    where: { id: communityId, deleted_at: null },
  });

  if (!community) {
    return ApiErrors.notFound("Community not found");
  }

  return successResponse<CommunityResponse>({ community: community as any });
});

/**
 * PATCH /api/communities/[communityId]
 * Update community — admin/owner only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const membership = await prisma.community_members.findFirst({
    where: {
      community_id: communityId,
      profile_id: user.id,
      membership_status: "active",
      member_role: { in: ["owner", "admin"] },
    },
  });

  if (!membership) {
    return ApiErrors.forbidden("Only owners and admins can update the community");
  }

  let rawData: Record<string, any>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = updateCommunitySchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  try {
    const updated = await prisma.communities.update({
      where: { id: communityId },
      data: validation.data,
    });

    return successResponse<CommunityResponse>({ community: updated as any });
  } catch (error) {
    console.error("Error updating community:", error);
    return ApiErrors.serverError();
  }
});

/**
 * DELETE /api/communities/[communityId]
 * Soft delete — owner only
 */
export const DELETE = withAuth(async (user, _request, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const membership = await prisma.community_members.findFirst({
    where: {
      community_id: communityId,
      profile_id: user.id,
      membership_status: "active",
      member_role: "owner",
    },
  });

  if (!membership) {
    return ApiErrors.forbidden("Only the owner can delete the community");
  }

  try {
    await prisma.communities.update({
      where: { id: communityId },
      data: { deleted_at: new Date(), is_active: false },
    });

    return successResponse({ message: "Community deleted" });
  } catch (error) {
    console.error("Error deleting community:", error);
    return ApiErrors.serverError();
  }
});

export async function POST() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}
