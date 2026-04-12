import { NextRequest } from "next/server";
import { randomUUID } from "crypto";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/communities/[communityId]/invite-link
 * Generate or refresh the community invite link (admin/owner/moderator only)
 */
export const POST = withAuth(async (user, _request: NextRequest, params) => {
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
    return ApiErrors.forbidden("You are not a member of this community");
  }

  if (!["owner", "admin", "moderator"].includes(membership.member_role || "")) {
    return ApiErrors.forbidden("You don't have permission to manage invite links");
  }

  const token = randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  try {
    await prisma.communities.update({
      where: { id: communityId },
      data: {
        invite_link_token: token,
        invite_link_expires_at: expiresAt,
      },
    });

    return successResponse(
      { token, expires_at: expiresAt.toISOString() },
      undefined,
      201
    );
  } catch (error) {
    console.error("Error generating invite link:", error);
    return ApiErrors.serverError();
  }
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

  const membership = await prisma.community_members.findFirst({
    where: {
      community_id: communityId,
      profile_id: user.id,
      membership_status: "active",
    },
    select: { member_role: true },
  });

  if (!membership) {
    return ApiErrors.forbidden("You are not a member of this community");
  }

  if (!["owner", "admin", "moderator"].includes(membership.member_role || "")) {
    return ApiErrors.forbidden("You don't have permission to manage invite links");
  }

  try {
    await prisma.communities.update({
      where: { id: communityId },
      data: {
        invite_link_token: null,
        invite_link_expires_at: null,
      },
    });

    return successResponse({ message: "Invite link revoked" });
  } catch (error) {
    console.error("Error revoking invite link:", error);
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
