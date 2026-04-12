import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  handleUnsupportedMethod,
  ApiErrors,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/communities/[communityId]/leave
 * Leave a community — sets membership_status to 'left'
 * Owner cannot leave (must transfer ownership first)
 */
export const POST = withAuth(async (user, _request, params) => {
  const communityId = params?.communityId;
  if (!communityId) {
    return ApiErrors.badRequest("Community ID is required");
  }

  const membership = await prisma.community_members.findFirst({
    where: { community_id: communityId, profile_id: user.id },
    select: { id: true, member_role: true, membership_status: true },
  });

  if (!membership) {
    return ApiErrors.notFound("You are not a member of this community");
  }

  if (membership.membership_status !== "active") {
    return ApiErrors.conflict("You are not an active member of this community");
  }

  if (membership.member_role === "owner") {
    return ApiErrors.forbidden(
      "The owner cannot leave the community. Transfer ownership first."
    );
  }

  try {
    await prisma.community_members.update({
      where: { id: membership.id },
      data: {
        membership_status: "left",
        membership_removed_at: new Date(),
      },
    });

    return successResponse({ message: "You have left the community" });
  } catch (error) {
    console.error("Error leaving community:", error);
    return ApiErrors.serverError();
  }
});

export async function GET() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["POST"]);
}
