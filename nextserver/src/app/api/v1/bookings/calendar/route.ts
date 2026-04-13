import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import { ValidationError } from "@/lib/errors/domain-errors";
import * as calendarService from "@/lib/services/calendar-service";

/**
 * GET /api/v1/bookings/calendar?month=2026-04
 * Returns all bookings for the authenticated user in the given month,
 * grouped by date with event counts for calendar dot indicators.
 */
export const GET = withAuth(async (user, request: NextRequest) => {
  const month = new URL(request.url).searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return handleServiceError(new ValidationError("Query parameter 'month' is required (YYYY-MM)"));
  }

  try {
    const [yearStr, monthStr] = month.split("-");
    const result = await calendarService.getCalendarMonth(user.id, parseInt(yearStr), parseInt(monthStr));
    return successResponse(result);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() { return handleUnsupportedMethod(["GET"]); }
