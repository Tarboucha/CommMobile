import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { sendMessageSchema, messageQuerySchema } from "@/lib/validations/message";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { assertCommunityMember } from "@/lib/guards/assert-community-member";
import { NotFoundError } from "@/lib/errors/domain-errors";

async function getCommunityConversationId(communityId: string): Promise<string> {
  const conversation = await prisma.conversations.findFirst({
    where: { community_id: communityId, conversation_type: "community" },
    select: { id: true },
  });
  if (!conversation) throw new NotFoundError("Conversation");
  return conversation.id;
}

export const GET = withAuth(async (user, request: NextRequest, params) => {
  try {
    await assertCommunityMember(params!.communityId, user.id);
    const conversationId = await getCommunityConversationId(params!.communityId);

    const searchParams = Object.fromEntries(new URL(request.url).searchParams.entries());
    const { limit, after } = messageQuerySchema.parse(searchParams);

    const where: Record<string, unknown> = {
      conversation_id: conversationId,
      is_deleted: false,
    };

    if (after) {
      const cursor = decodeCursor(after);
      if (cursor) {
        where.OR = [
          { created_at: { lt: new Date(cursor.created_at) } },
          { created_at: { equals: new Date(cursor.created_at) }, id: { lt: cursor.id } },
        ];
      }
    }

    const messages = await prisma.messages.findMany({
      where,
      include: {
        profiles: {
          select: { id: true, display_name: true, first_name: true, last_name: true, avatar_url: true },
        },
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const shaped = messages.map((m) => {
      const { profiles, ...rest } = m;
      return { ...rest, sender: profiles, created_at: rest.created_at?.toISOString() ?? null };
    });

    return successResponse(buildPaginatedResponse(shaped, limit));
  } catch (err) {
    return handleServiceError(err);
  }
});

export const POST = withAuth(async (user, request: NextRequest, params) => {
  try {
    await assertCommunityMember(params!.communityId, user.id);
    const conversationId = await getCommunityConversationId(params!.communityId);
    const input = await parseJsonBody(request, sendMessageSchema);

    const message = await prisma.messages.create({
      data: {
        conversation_id: conversationId,
        sender_id: user.id,
        content: input.content,
      },
      include: {
        profiles: {
          select: { id: true, display_name: true, first_name: true, last_name: true, avatar_url: true },
        },
      },
    });

    const { profiles, ...rest } = message;
    return successResponse({ message: { ...rest, sender: profiles } }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]); }
