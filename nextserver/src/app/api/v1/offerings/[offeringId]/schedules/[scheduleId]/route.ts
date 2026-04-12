import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { updateScheduleSchema } from "@/lib/validations/offering";
import { parseJsonBody } from "@/lib/utils/parse-request";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as offeringService from "@/lib/services/offering-service";

export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  try {
    const input = await parseJsonBody(request, updateScheduleSchema);
    const schedule = await offeringService.updateSchedule(
      params!.offeringId, params!.scheduleId, user.id, input
    );
    return successResponse({ schedule });
  } catch (err) {
    return handleServiceError(err);
  }
});

export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  try {
    await offeringService.deleteSchedule(params!.offeringId, params!.scheduleId, user.id);
    return successResponse({ deleted: true });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function GET() { return handleUnsupportedMethod(["PATCH", "DELETE"]); }
export async function POST() { return handleUnsupportedMethod(["PATCH", "DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["PATCH", "DELETE"]); }
