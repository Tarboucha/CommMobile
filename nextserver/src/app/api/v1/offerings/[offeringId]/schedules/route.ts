import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { createScheduleSchema } from "@/lib/validations/offering";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as offeringService from "@/lib/services/offering-service";

export const GET = withAuth(async (_user, _request: NextRequest, params) => {
  try {
    const schedules = await offeringService.listSchedules(params!.offeringId);
    return successResponse({ schedules });
  } catch (err) {
    return handleServiceError(err);
  }
});

export const POST = withAuth(async (user, request: NextRequest, params) => {
  try {
    const input = await parseJsonBody(request, createScheduleSchema);
    const schedule = await offeringService.createSchedule(params!.offeringId, user.id, input);
    return successResponse({ schedule }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]); }
