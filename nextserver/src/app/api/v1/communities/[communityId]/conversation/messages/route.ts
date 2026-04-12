import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { sendMessageSchema, messageQuerySchema } from "@/lib/validations/message";
import { decodeCursor, buildPaginatedResponse } from "@/lib/utils/pagination";

/**
 * GET /api/communities/:communityId/conversation/messages
 * Paginated message history (newest first).
 */
export const GET = withAuth(
  async (user, request: NextRequest, params) => {
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
      select: { id: true },
    });

    if (!conversation) {
      return ApiErrors.notFound("Conversation");
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
        conversation_id: conversation.id,
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

      // Reshape: rename 'profiles' to 'sender' for API contract
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
 * POST /api/communities/:communityId/conversation/messages
 * Send a message to the community chat.
 */
export const POST = withAuth(
  async (user, request: NextRequest, params) => {
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
      select: { id: true },
    });

    if (!conversation) {
      return ApiErrors.notFound("Conversation");
    }

    let rawData: Record<string, any>;
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
          conversation_id: conversation.id,
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
