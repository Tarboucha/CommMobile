import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import {
  successResponse,
  ApiErrors,
  parseZodError,
  handleUnsupportedMethod,
} from "@/lib/utils/api-response";
import { prisma } from "@/lib/prisma";
import { updateOfferingSchema } from "@/lib/validations/offering";

/**
 * GET /api/offerings/[offeringId]
 * Get offering detail with schedules
 */
export const GET = withAuth(async (_user, _request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  if (!offeringId) {
    return ApiErrors.badRequest("Offering ID is required");
  }

  const offering = await prisma.offerings.findFirst({
    where: { id: offeringId, deleted_at: null },
    include: {
      profiles: { select: { id: true, first_name: true, last_name: true, avatar_url: true } },
      availability_schedules: true,
    },
  });

  if (!offering) {
    return ApiErrors.notFound("Offering");
  }

  return successResponse({ offering: offering as any });
});

/**
 * PATCH /api/offerings/[offeringId]
 * Update offering — provider only
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  if (!offeringId) {
    return ApiErrors.badRequest("Offering ID is required");
  }

  const existing = await prisma.offerings.findFirst({
    where: { id: offeringId, deleted_at: null },
    select: { id: true, provider_id: true },
  });

  if (!existing) {
    return ApiErrors.notFound("Offering");
  }

  if (existing.provider_id !== user.id) {
    return ApiErrors.forbidden("You can only edit your own offerings");
  }

  let rawData: Record<string, unknown>;
  try {
    rawData = await request.json();
  } catch {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  const validation = updateOfferingSchema.safeParse(rawData);
  if (!validation.success) {
    return ApiErrors.validationError(parseZodError(validation.error));
  }

  try {
    const offering = await prisma.offerings.update({
      where: { id: offeringId },
      data: { ...validation.data, updated_at: new Date() },
    });

    return successResponse({ offering: offering as any });
  } catch (error) {
    console.error("Failed to update offering:", error);
    return ApiErrors.serverError();
  }
});

/**
 * DELETE /api/offerings/[offeringId]
 * Soft delete offering — provider only
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  const offeringId = params?.offeringId;
  if (!offeringId) {
    return ApiErrors.badRequest("Offering ID is required");
  }

  const existing = await prisma.offerings.findFirst({
    where: { id: offeringId, deleted_at: null },
    select: { id: true, provider_id: true },
  });

  if (!existing) {
    return ApiErrors.notFound("Offering");
  }

  if (existing.provider_id !== user.id) {
    return ApiErrors.forbidden("You can only delete your own offerings");
  }

  try {
    await prisma.offerings.update({
      where: { id: offeringId },
      data: { deleted_at: new Date(), status: "deleted" },
    });

    return successResponse({ deleted: true });
  } catch (error) {
    console.error("Failed to delete offering:", error);
    return ApiErrors.serverError();
  }
});

export async function POST() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}
