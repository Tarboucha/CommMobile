import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertCommunityMember } from "@/lib/guards/assert-community-member";
import { NotFoundError } from "@/lib/errors/domain-errors";

export const GET = withAuth(async (user, _request: NextRequest, params) => {
  try {
    await assertCommunityMember(params!.communityId, user.id);

    const conversation = await prisma.conversations.findFirst({
      where: { community_id: params!.communityId, conversation_type: "community" },
    });
    if (!conversation) throw new NotFoundError("Conversation");

    return successResponse({ conversation });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() { return handleUnsupportedMethod(["GET"]); }
export async function PUT() { return handleUnsupportedMethod(["GET"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET"]); }
