import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { sendMessageSchema, messageQuerySchema } from "@/lib/validations/message";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";

async function isActiveParticipant(
  conversationId: string,
  profileId: string
): Promise<boolean> {
  const participant = await prisma.conversation_participants.findFirst({
    where: {
      conversation_id: conversationId,
      profile_id: profileId,
      left_at: null,
      removed_at: null,
    },
  });
  return !!participant;
}

/**
 * GET /api/conversations/:conversationId/messages
 * Paginated message history for any conversation type (booking or direct).
 */
export const GET = withAuth(
  async (user, request: NextRequest, params) => {
    const { conversationId } = params!;

    if (!(await isActiveParticipant(conversationId, user.id))) {
      return ApiErrors.notConversationParticipant();
    }

    const searchParams = Object.fromEntries(
      new URL(request.url).searchParams.entries()
    );

    const validation = messageQuerySchema.safeParse(searchParams);
    if (!validation.success) {
      return ApiErrors.validationError(parseZodError(validation.error));
    }

    const { limit, after } = validation.data;

    try {
      const where: any = {
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
    } catch (error) {
      console.error("Error fetching messages:", error);
      return ApiErrors.serverError();
    }
  }
);

/**
 * POST /api/conversations/:conversationId/messages
 * Send a message to any conversation (booking or direct).
 */
export const POST = withAuth(
  async (user, request: NextRequest, params) => {
    const { conversationId } = params!;

    if (!(await isActiveParticipant(conversationId, user.id))) {
      return ApiErrors.notConversationParticipant();
    }

    let rawData: Record<string, unknown>;
    try {
      rawData = await request.json();
    } catch {
      return ApiErrors.badRequest("Invalid JSON in request body");
    }

    const validation = sendMessageSchema.safeParse(rawData);
    if (!validation.success) {
      return ApiErrors.validationError(parseZodError(validation.error));
    }

    try {
      const message = await prisma.messages.create({
        data: {
          conversation_id: conversationId,
          sender_id: user.id,
          content: validation.data.content,
        },
        include: {
          profiles: {
            select: { id: true, display_name: true, first_name: true, last_name: true, avatar_url: true },
          },
        },
      });

      const { profiles, ...rest } = message;
      return successResponse({ message: { ...rest, sender: profiles } }, undefined, 201);
    } catch (error) {
      console.error("Error sending message:", error);
      return ApiErrors.serverError();
    }
  }
);

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "POST"]);
}
