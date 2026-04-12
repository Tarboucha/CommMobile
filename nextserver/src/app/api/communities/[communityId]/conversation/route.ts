import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, ApiErrors } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";

/**
 * GET /api/communities/:communityId/conversation
 * Get the community's group conversation.
 */
export const GET = withAuth(
  async (user, _request: NextRequest, params) => {
    const { communityId } = params!;

    const membership = await prisma.community_members.findFirst({
      where: {
        community_id: communityId,
        profile_id: user.id,
        membership_status: "active",
      },
    });

    if (!membership) {
      return ApiErrors.notCommunityMember();
    }

    const conversation = await prisma.conversations.findFirst({
      where: {
        community_id: communityId,
        conversation_type: "community",
      },
    });

    if (!conversation) {
      return ApiErrors.notFound("Conversation");
    }

    return successResponse({ conversation: conversation as any });
  }
);
