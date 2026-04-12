import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod } from "@/lib/utils/api-response";
import { addressUpdateSchema } from "@/lib/validations/address";
import { handleServiceError } from "@/lib/errors/handle-service-error";
import * as addressService from "@/lib/services/address-service";

/**
 * GET /api/addresses/[addressId]
 * Get a specific address by ID
 */
export const GET = withAuth(async (user, _request: NextRequest, params) => {
  try {
    const address = await addressService.getAddress(params!.addressId, user.id);
    return successResponse({ address });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * PATCH /api/addresses/[addressId]
 * Update a specific address by ID
 */
export const PATCH = withAuth(async (user, request: NextRequest, params) => {
  try {
    // Parse raw JSON — needed for geocoding field detection
    let rawData: Record<string, any>;
    try {
      rawData = await request.json();
    } catch {
      const { ValidationError } = await import("@/lib/errors/domain-errors");
      throw new ValidationError("Invalid JSON in request body");
    }

    // Validate with partial schema
    const { parseZodError } = await import("@/lib/utils/api-response");
    const validation = addressUpdateSchema.safeParse(rawData);
    if (!validation.success) {
      const { ValidationError } = await import("@/lib/errors/domain-errors");
      throw new ValidationError(parseZodError(validation.error));
    }

    const updated = await addressService.updateAddress(
      params!.addressId,
      user.id,
      rawData,
      validation.data
    );
    return successResponse({ address: updated });
  } catch (err) {
    return handleServiceError(err);
  }
});

/**
 * DELETE /api/addresses/[addressId]
 * Soft delete a specific address by ID
 */
export const DELETE = withAuth(async (user, _request: NextRequest, params) => {
  try {
    await addressService.deleteAddress(params!.addressId, user.id);
    return successResponse({ message: "Address deleted successfully" });
  } catch (err) {
    return handleServiceError(err);
  }
});

export async function POST() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]); }
export async function PUT() { return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]); }
