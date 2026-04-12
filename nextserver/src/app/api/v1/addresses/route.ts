import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { addressSchema } from "@/lib/validations/address";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as addressService from "@/lib/services/address-service";

/**
 * GET /api/addresses
 * List all addresses for current authenticated user
 */
export const GET = withAuth(async (user, _request: NextRequest) => {
  try {
    const result = await addressService.listAddresses(user.id);
    return successResponse(result);
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * POST /api/addresses
 * Create a new address for the current authenticated user
 */
export const POST = withAuth(async (user, request: NextRequest) => {
  try {
    // We need raw data for geocoding before validation,
    // then validate the merged (geocoded) data in the service.
    // Parse raw JSON first, then validate with schema after setting profile_id.
    let rawData: Record<string, any>;
    try {
      rawData = await request.json();
    } catch {
      const { ValidationError } = await import("@/lib/errors/domain-errors");
      throw new ValidationError("Invalid JSON in request body");
    }

    rawData.profile_id = user.id;

    // Validate the raw input with the address schema
    const { parseZodError } = await import("@/lib/utils/api-response");
    const validation = addressSchema.safeParse(rawData);
    if (!validation.success) {
      const { ValidationError } = await import("@/lib/errors/domain-errors");
      throw new ValidationError(parseZodError(validation.error));
    }

    const address = await addressService.createAddress(
      user.id,
      rawData,
      validation.data
    );
    return successResponse({ address }, undefined, 201);
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function PUT() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function PATCH() { return handleUnsupportedMethod(["GET", "POST"]); }
export async function DELETE() { return handleUnsupportedMethod(["GET", "POST"]); }
