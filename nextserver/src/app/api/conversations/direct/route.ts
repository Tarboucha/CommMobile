import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { createDirectConversationSchema } from "@/lib/validations/conversation";

/**
 * POST /api/conversations/direct
 * Find or create a direct conversation between the authenticated user and another user.
 */
export const POST = withAuth(async (user, request: NextRequest) => {
  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = createDirectConversationSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { other_profile_id } = validation.data;

  if (other_profile_id === user.id) {
    return ApiErrors.badRequest("Cannot create a conversation with yourself");
  }

  const otherProfile = await prisma.profiles.findUnique({
    where: { id: other_profile_id },
    select: { id: true },
  });

  if (!otherProfile) {
    return ApiErrors.notFound("Profile");
  }

  try {
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

        if (conversation) {
          return successResponse({ conversation: conversation as any });
        }
      }
    }

    // Use SECURITY DEFINER RPC to atomically create conversation + participants
    // Keep Supabase client for this RPC call
    const supabase = await createClient();
    const { data: result, error: rpcError } = await supabase.rpc(
      "create_direct_conversation",
      { p_other_profile_id: other_profile_id }
    );

    if (rpcError || !result) {
      console.error("Failed to create direct conversation:", rpcError);
      return ApiErrors.serverError();
    }

    const conversation = await prisma.conversations.findUnique({
      where: { id: result },
    });

    if (!conversation) {
      console.error("Failed to fetch newly created conversation");
      return ApiErrors.serverError();
    }

    return successResponse({ conversation: conversation as any }, undefined, 201);
  } catch (error) {
    console.error("Error in direct conversation:", error);
    return ApiErrors.serverError();
  }
});

export async function GET() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["POST"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["POST"]);
}
