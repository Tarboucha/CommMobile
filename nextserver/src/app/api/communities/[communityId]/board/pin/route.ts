import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { pinItemSchema } from "@/lib/validations/post";

/**
 * POST /api/communities/[communityId]/board/pin
 * Pin an item (offering or post) to the top of the board.
 */
export const POST = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const membership = await prisma.community_members.findFirst({
    where: {
      community_id: communityId,
      profile_id: user.id,
      membership_status: "active",
    },
    select: { member_role: true },
  });

  if (!membership) {
    return ApiErrors.forbidden("You must be an active member of this community");
  }

  if (!["owner", "admin"].includes(membership.member_role ?? "")) {
    return ApiErrors.notCommunityAdmin();
  }

  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = pinItemSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { item_type, item_id } = validation.data;

  // Verify the item exists and belongs to this community
  if (item_type === "offering") {
    const offering = await prisma.offerings.findFirst({
      where: { id: item_id, community_id: communityId, deleted_at: null, status: "active" },
    });
    if (!offering) return ApiErrors.notFound("Offering");
  } else {
    const post = await prisma.community_posts.findFirst({
      where: { id: item_id, community_id: communityId, deleted_at: null, status: "active" },
    });
    if (!post) return ApiErrors.notFound("Post");
  }

  try {
    // Delete existing pin
    await prisma.community_pinned_items.deleteMany({
      where: { community_id: communityId },
    });

    // Insert new pin
    await prisma.community_pinned_items.create({
      data: {
        community_id: communityId,
        pinned_by_profile_id: user.id,
        pinned_offering_id: item_type === "offering" ? item_id : null,
        pinned_post_id: item_type === "post" ? item_id : null,
      },
    });

    return successResponse({ pinned: true }, undefined, 201);
  } catch (error) {
    console.error("Failed to pin item:", error);
    return ApiErrors.serverError();
  }
});

/**
 * DELETE /api/communities/[communityId]/board/pin
 * Remove the pinned item from the board.
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const membership = await prisma.community_members.findFirst({
    where: {
      community_id: communityId,
      profile_id: user.id,
      membership_status: "active",
    },
    select: { member_role: true },
  });

  if (!membership) {
    return ApiErrors.forbidden("You must be an active member of this community");
  }

  if (!["owner", "admin"].includes(membership.member_role ?? "")) {
    return ApiErrors.notCommunityAdmin();
  }

  try {
    await prisma.community_pinned_items.deleteMany({
      where: { community_id: communityId },
    });

    return successResponse({ unpinned: true });
  } catch (error) {
    console.error("Failed to unpin item:", error);
    return ApiErrors.serverError();
  }
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
