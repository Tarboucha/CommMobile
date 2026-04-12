import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as offeringService from "@/lib/services/offering-service";

export const GET = withAuth(async (_user, request: NextRequest, params) => {
  const date = new URL(request.url).searchParams.get("date");
  if (!date) return handleServiceError(new Error("Query parameter 'date' is required"));

  try {
    const result = await offeringService.getTimeSlots(
      params!.offeringId, params!.scheduleId, date
    );
    return successResponse(result);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() { return handleUnsupportedMethod(["GET"]); }
