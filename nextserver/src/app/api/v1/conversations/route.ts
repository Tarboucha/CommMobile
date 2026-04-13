import { NextRequest } from "next/server";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { conversation_type } from "@/generated/prisma/client";
import { conversationsListQuerySchema } from "@/lib/validations/conversation";

/**
 * GET /api/conversations
 * List the authenticated user's conversations (direct and/or booking).
 */
export const GET = withAuth(async (user, request: NextRequest) => {
  const searchParams = Object.fromEntries(
    new URL(request.url).searchParams.entries()
  );

  const validation = conversationsListQuerySchema.safeParse(searchParams);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  const { type } = validation.data;

  try {
    // Get user's active participations with conversation details
    const conversationTypes = (type ? [type] : ["direct", "booking"]) as conversation_type[];

    const participations = await prisma.conversation_participants.findMany({
      where: {
        profile_id: user.id,
        left_at: null,
        removed_at: null,
        conversations: {
          conversation_type: { in: conversationTypes },
        },
      },
      include: {
        conversations: true,
      },
      orderBy: {
        conversations: { last_message_at: { sort: "desc", nulls: "last" } },
      },
    });

    if (participations.length === 0) {
      return successResponse({ conversations: [] });
    }

    const conversationIds = participations.map((p) => p.conversation_id);

    // Fetch other participants' profiles
    const otherParticipants = await prisma.conversation_participants.findMany({
      where: {
        conversation_id: { in: conversationIds },
        profile_id: { not: user.id },
        left_at: null,
        removed_at: null,
      },
      include: {
        profiles_conversation_participants_profile_idToprofiles: {
          select: { id: true, display_name: true, first_name: true, last_name: true, avatar_url: true },
        },
      },
    });

    // Group participants by conversation
    const participantsByConvo = new Map<string, any[]>();
    for (const p of otherParticipants) {
      const existing = participantsByConvo.get(p.conversation_id) || [];
      if (p.profiles_conversation_participants_profile_idToprofiles) {
        existing.push(p.profiles_conversation_participants_profile_idToprofiles);
      }
      participantsByConvo.set(p.conversation_id, existing);
    }

    // Build response
    const conversations = participations.map((p) => {
      const convo = (p as Record<string, unknown>).conversations as {
        id: string;
        conversation_type: string;
        booking_id: string | null;
        community_id: string | null;
        title: string | null;
        last_message_at: Date | null;
        last_message_preview: string | null;
        created_at: Date | null;
      };
      return {
        id: convo.id,
        conversation_type: convo.conversation_type,
        booking_id: convo.booking_id,
        community_id: convo.community_id,
        title: convo.title,
        last_message_at: convo.last_message_at,
        last_message_preview: convo.last_message_preview,
        created_at: convo.created_at,
        last_read_at: p.last_read_at,
        is_muted: p.is_muted,
        participants: participantsByConvo.get(p.conversation_id) || [],
      };
    });

    return successResponse({ conversations });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET"]);
}
