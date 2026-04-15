import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";

const registerSchema = z.object({
  token: z.string().min(1, "Push token is required"),
  device_type: z.enum(["ios", "android"]).optional(),
  device_name: z.string().max(100).optional(),
});

const deleteSchema = z.object({
  token: z.string().min(1, "Push token is required"),
});

/**
 * POST /api/v1/push-tokens
 * Register or re-activate a push token for the authenticated user.
 * Upserts: if the token already exists, updates last_used_at + is_active.
 */
export const POST = withAuth(async (user, request: NextRequest) => {
  try {
    const input = await parseJsonBody(request, registerSchema);

    const existing = await prisma.push_tokens.findUnique({
      where: { token: input.token },
    });

    if (existing) {
      // Re-activate if owned by this user, or reassign if device changed hands
      await prisma.push_tokens.update({
        where: { token: input.token },
        data: {
          profile_id: user.id,
          is_active: true,
          last_used_at: new Date(),
          device_type: input.device_type ?? existing.device_type,
          device_name: input.device_name ?? existing.device_name,
        },
      });
    } else {
      await prisma.push_tokens.create({
        data: {
          profile_id: user.id,
          token: input.token,
          device_type: input.device_type ?? null,
          device_name: input.device_name ?? null,
          is_active: true,
          last_used_at: new Date(),
        },
      });
    }

    return successResponse({ registered: true }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/v1/push-tokens
 * Deactivate a push token (on logout). Soft-delete: token stays in DB
 * but is_active = false, so push notifications won't be sent to it.
 */
export const DELETE = withAuth(async (user, request: NextRequest) => {
  try {
    const input = await parseJsonBody(request, deleteSchema);

    await prisma.push_tokens.updateMany({
      where: {
        token: input.token,
        profile_id: user.id,
      },
      data: { is_active: false },
    });

    return successResponse({ deactivated: true });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["POST", "DELETE"]); }
export async function PATCH() { return handleUnsupportedMethod(["POST", "DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["POST", "DELETE"]); }
