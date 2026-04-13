import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { createDirectConversationSchema } from "@/lib/validations/conversation";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { NotFoundError, SelfActionError } from "@/lib/errors/domain-errors";
import { mapRpcError } from "@/lib/utils/rpc-errors";

/**
 * POST /api/conversations/direct
 * Find or create a direct conversation between the authenticated user and another user.
 */
export const POST = withAuth(async (user, request: NextRequest) => {
  try {
    const { other_profile_id } = await parseJsonBody(request, createDirectConversationSchema);

    if (other_profile_id === user.id) {
      throw new SelfActionError("Cannot create a conversation with yourself");
    }

    const otherProfile = await prisma.profiles.findUnique({
      where: { id: other_profile_id },
      select: { id: true },
    });
    if (!otherProfile) throw new NotFoundError("Profile");

    // Find existing direct conversation between the two users
    const myParticipations = await prisma.conversation_participants.findMany({
      where: {
        profile_id: user.id,
        left_at: null,
        removed_at: null,
        conversations: { conversation_type: "direct" },
      },
      select: { conversation_id: true },
    });

    const myConvoIds = myParticipations.map((p) => p.conversation_id);

    if (myConvoIds.length > 0) {
      const match = await prisma.conversation_participants.findFirst({
        where: {
          profile_id: other_profile_id,
          conversation_id: { in: myConvoIds },
          left_at: null,
          removed_at: null,
        },
        select: { conversation_id: true },
      });

      if (match) {
        const conversation = await prisma.conversations.findUnique({
          where: { id: match.conversation_id },
        });
        if (conversation) return successResponse({ conversation });
      }
    }

    // Create via SECURITY DEFINER RPC (atomic conversation + participants)
    let conversationId: string;
    try {
      const result = await prisma.$queryRaw<[{ create_direct_conversation: string }]>`
        SELECT public.create_direct_conversation(${other_profile_id}::uuid, ${user.id}::uuid) AS create_direct_conversation
      `;
      conversationId = result[0].create_direct_conversation;
    } catch (err) {
      mapRpcError(err);
    }

    const conversation = await prisma.conversations.findUnique({
      where: { id: conversationId },
    });

    return successResponse({ conversation }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["POST"]); }
export async function PUT() { return handleUnsupportedMethod(["POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["POST"]); }
