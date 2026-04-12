import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { updateMemberSchema } from "@/lib/validations/community";
import type { CommunityMemberResponse } from "@/types/community";

/**
 * PATCH /api/communities/[communityId]/members/[memberId]
 * Update member role/permissions/status — admin/owner only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const communityId = params?.communityId;
  const memberId = params?.memberId;
  if (!communityId || !memberId) {
    return ApiErrors.badRequest("Community ID and Member ID are required");
  }

  const requesterMembership = await prisma.community_members.findFirst({
    where: {
      community_id: communityId,
      profile_id: user.id,
      membership_status: "active",
      member_role: { in: ["owner", "admin"] },
    },
  });

  if (!requesterMembership) {
    return ApiErrors.forbidden("Only admins can manage members");
  }

  const targetMember = await prisma.community_members.findFirst({
    where: { id: memberId, community_id: communityId },
  });

  if (!targetMember) {
    return ApiErrors.notFound("Member not found");
  }

  if (targetMember.member_role === "owner") {
    return ApiErrors.forbidden("Cannot modify the community owner");
  }

  let rawData: Record<string, any>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = updateMemberSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const updateData: Record<string, any> = { ...validation.data };

  if (updateData.membership_status === "active" && targetMember.membership_status === "pending") {
    updateData.membership_approved_at = new Date();
    updateData.approved_by_profile_id = user.id;
  }

  if (updateData.membership_status === "removed") {
    updateData.membership_removed_at = new Date();
    updateData.removed_by_profile_id = user.id;
  }

  try {
    const updated = await prisma.community_members.update({
      where: { id: memberId },
      data: updateData,
    });

    return successResponse<CommunityMemberResponse>({ member: updated as any });
  } catch (error) {
    console.error("Error updating member:", error);
    return ApiErrors.serverError();
  }
});

/**
 * DELETE /api/communities/[communityId]/members/[memberId]
 * Remove a member — admin/owner only
 */
export const DELETE = withAuth(async (user, _request, params) => {
  const communityId = params?.communityId;
  const memberId = params?.memberId;
  if (!communityId || !memberId) {
    return ApiErrors.badRequest("Community ID and Member ID are required");
  }

  const requesterMembership = await prisma.community_members.findFirst({
    where: {
      community_id: communityId,
      profile_id: user.id,
      membership_status: "active",
      member_role: { in: ["owner", "admin"] },
    },
  });

  if (!requesterMembership) {
    return ApiErrors.forbidden("Only admins can remove members");
  }

  const targetMember = await prisma.community_members.findFirst({
    where: { id: memberId, community_id: communityId },
    select: { member_role: true },
  });

  if (!targetMember) {
    return ApiErrors.notFound("Member not found");
  }

  if (targetMember.member_role === "owner") {
    return ApiErrors.forbidden("Cannot remove the community owner");
  }

  try {
    await prisma.community_members.update({
      where: { id: memberId },
      data: {
        membership_status: "removed",
        membership_removed_at: new Date(),
        removed_by_profile_id: user.id,
      },
    });

    return successResponse({ message: "Member removed" });
  } catch (error) {
    console.error("Error removing member:", error);
    return ApiErrors.serverError();
  }
});

export async function GET() {
  return handleUnsupportedMethod(["PATCH", "DELETE"]);
}

export async function POST() {
  return handleUnsupportedMethod(["PATCH", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["PATCH", "DELETE"]);
}
