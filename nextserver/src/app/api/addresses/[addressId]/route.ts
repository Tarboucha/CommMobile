import { NextRequest } from "next/server";
import { successResponse, handleUnsupportedMethod, ApiErrors } from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { addressUpdateSchema, type AddressUpdateInput } from "@/lib/validations/address";
import type { AddressResponse } from "@/types/address";
import type { AddressUpdate } from "@/types/address";
import { withAuth } from "@/lib/utils/api-route-helper";
import { geocodeAddressFromInput, RateLimiterTimeoutError } from "@/lib/utils/nominatim";

/**
 * GET /api/addresses/[addressId]
 * Get a specific address by ID
 * Users can only access their own addresses
 */
export const GET = withAuth(async (user, request, params) => {
  const { addressId } = params!;

  const supabase = await createClient();

  // Fetch address
  const { data: address, error: fetchError } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", addressId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !address) {
    return ApiErrors.notFound("Address not found");
  }

  // Users can only access their own addresses
  if (address.profile_id !== user.id) {
    return ApiErrors.forbidden("You can only access your own addresses");
  }

  return successResponse<AddressResponse>({
    address,
  });
});

/**
 * PATCH /api/addresses/[addressId]
 * Update a specific address by ID
 * Users can only update their own addresses
 * Handles is_default logic: if setting is_default=true, sets other addresses to false
 */
export const PATCH = withAuth(async (user, request, params) => {
  const { addressId } = params!;

  const supabase = await createClient();

  // First, verify address exists and belongs to user
  const { data: existingAddress, error: fetchError } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .is("deleted_at", null)
      .single();

    if (fetchError || !existingAddress) {
      return ApiErrors.notFound("Address not found");
    }

    // Users can only update their own addresses
    if (existingAddress.profile_id !== user.id) {
      return ApiErrors.forbidden("You can only update your own addresses");
    }

    // Parse request body
    let rawData: Record<string, any>;
    try {
      rawData = await request.json();
      // Log raw request data to debug state field issue
      console.log("[Address PATCH] Raw request data:", {
        state: rawData.state,
        stateInRawData: "state" in rawData,
        allFields: Object.keys(rawData),
      });
    } catch (error) {
      return ApiErrors.badRequest("Invalid JSON in request body");
    }

    // Check if address fields are being updated
    // A field is considered updated if it's in rawData (even if empty/null)
    const addressFields = ["street_number", "street_name", "city", "state", "postal_code", "country"];
    const isAddressFieldUpdated = addressFields.some(
      (field) => field in rawData
    );

    // If address fields are updated, geocode the address
    if (isAddressFieldUpdated) {
      // Build address for geocoding using form data
      // Key principle: Always use form data when provided, even if empty
      // Only fall back to existing address if field is NOT in rawData at all
      // For required fields: if form sends empty, we still need a value for geocoding, so use existing
      // For optional fields (state, street_number): if form sends empty/null/undefined, omit from geocoding request
      const addressForGeocoding: Parameters<typeof geocodeAddressFromInput>[0] = {
        street_name: "street_name" in rawData 
          ? (rawData.street_name || existingAddress.street_name) // Form data first, fallback to existing if empty
          : existingAddress.street_name,
        city: "city" in rawData 
          ? (rawData.city || existingAddress.city) // Form data first, fallback to existing if empty
          : existingAddress.city,
        // State is optional - if form sends empty/null/undefined, use undefined (don't send old value)
        // Check if state is explicitly in rawData AND has a non-empty value
        state: ("state" in rawData && rawData.state && rawData.state !== "")
          ? rawData.state
          : undefined, // Always use undefined if form sends empty/null/undefined, never use old value
        postal_code: "postal_code" in rawData 
          ? (rawData.postal_code || existingAddress.postal_code) // Form data first, fallback to existing if empty
          : existingAddress.postal_code,
        country: "country" in rawData 
          ? (rawData.country || existingAddress.country) // Form data first, fallback to existing if empty
          : existingAddress.country,
      };
      
      // Only include street_number if it's provided and not empty
      // If user explicitly sends empty string, omit it from geocoding (don't use existing value)
      if ("street_number" in rawData) {
        if (rawData.street_number && rawData.street_number.trim() !== "") {
          addressForGeocoding.street_number = rawData.street_number;
        }
        // If empty string, don't include it (omit from geocoding request)
      } else {
        // If not in rawData, use existing value if it exists
        if (existingAddress.street_number) {
          addressForGeocoding.street_number = existingAddress.street_number;
        }
      }

      // Log what we're sending to Nominatim for debugging
      console.log("[Address PATCH] Geocoding address:", {
        street_number: addressForGeocoding.street_number,
        street_name: addressForGeocoding.street_name,
        city: addressForGeocoding.city,
        state: addressForGeocoding.state,
        postal_code: addressForGeocoding.postal_code,
        country: addressForGeocoding.country,
      });

      // Geocode address using Nominatim API
      let geocodedAddress;
      try {
        geocodedAddress = await geocodeAddressFromInput(addressForGeocoding);

        if (!geocodedAddress) {
          console.error("[Address PATCH] Geocoding failed - no results for:", addressForGeocoding);
          return ApiErrors.badRequest(
            "Address could not be geocoded. Please check and correct your address."
          );
        }
      } catch (error) {
        console.error("[Address PATCH] Geocoding error:", error, "Address sent:", addressForGeocoding);
        
        // Check if it's a rate limiter timeout
        if (error instanceof RateLimiterTimeoutError) {
          return ApiErrors.badRequest(
            "Geocoding request timed out. Please try again in a moment. The service is processing other requests."
          );
        }
        
        // Check if it's a geocoding service error
        if (error instanceof Error && error.message.includes("temporarily unavailable")) {
          return ApiErrors.badRequest(
            "Geocoding service is temporarily unavailable. Please try again in a moment."
          );
        }
        
        // Default geocoding failure message
        return ApiErrors.badRequest(
          "Address could not be geocoded. Please check and correct your address."
        );
      }

      // Merge geocoded address data with update data
      // Use geocoded data for address fields, keep user input for metadata
      rawData = {
        ...rawData,
        // Use normalized address data from Nominatim
        // Only include street_number if Nominatim provided it
        ...(geocodedAddress.street_number && { street_number: geocodedAddress.street_number }),
        street_name: geocodedAddress.street_name,
        city: geocodedAddress.city,
        state: geocodedAddress.state,
        postal_code: geocodedAddress.postal_code,
        country: geocodedAddress.country,
        latitude: geocodedAddress.latitude,
        longitude: geocodedAddress.longitude,
        // Keep user input for metadata (apartment_unit, label, delivery_instructions, etc.)
      };
    }

    // Validate with addressUpdateSchema (partial - all fields optional for updates)
    const validation = addressUpdateSchema.safeParse(rawData);
    if (!validation.success) {
      const firstError = validation.error.issues[0];
      return ApiErrors.badRequest(firstError.message);
    }

    const updateData: AddressUpdateInput = validation.data;

    // Validation already normalized empty strings to null for nullable fields
    const processedData: AddressUpdate = { ...updateData } as AddressUpdate;

    // If setting is_default to true, unset other default addresses for this profile
    if (processedData.is_default === true) {
      const { error: updateError } = await supabase
        .from("addresses")
        .update({ is_default: false })
        .eq("profile_id", existingAddress.profile_id)
        .neq("id", addressId)
        .is("deleted_at", null);

      if (updateError) {
        console.error("Failed to unset other default addresses:", updateError);
        return ApiErrors.serverError();
      }
    }

    // Update address in database
    const { error: updateError } = await supabase
      .from("addresses")
      .update({
        ...processedData,
        updated_at: new Date().toISOString(),
      })
      .eq("id", addressId);

    if (updateError) {
      console.error("Failed to update address:", updateError);
      return ApiErrors.serverError();
    }

    // Fetch updated address
    const { data: updatedAddress, error: fetchUpdatedError } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", addressId)
      .single();

    if (fetchUpdatedError || !updatedAddress) {
      return ApiErrors.notFound("Failed to fetch updated address");
    }

  return successResponse<AddressResponse>({
    address: updatedAddress,
  });
});

/**
 * DELETE /api/addresses/[addressId]
 * Soft delete a specific address by ID
 * Users can only delete their own addresses
 */
export const DELETE = withAuth(async (user, request, params) => {
  const { addressId } = params!;

  const supabase = await createClient();

  // First, verify address exists and belongs to user
  const { data: existingAddress, error: fetchError } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", addressId)
    .is("deleted_at", null)
    .single();

  if (fetchError || !existingAddress) {
    return ApiErrors.notFound("Address not found");
  }

  // Users can only delete their own addresses
  if (existingAddress.profile_id !== user.id) {
    return ApiErrors.forbidden("You can only delete your own addresses");
  }

    // Soft delete by setting deleted_at timestamp
    const { error: deleteError } = await supabase
      .from("addresses")
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", addressId);

    if (deleteError) {
      console.error("Failed to delete address:", deleteError);
      return ApiErrors.serverError();
    }

  return successResponse(
    {
      message: "Address deleted successfully",
    },
    undefined,
    200
  );
});

// Catch unsupported methods
export async function POST() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}

export async function PUT() {
  return handleUnsupportedMethod(["GET", "PATCH", "DELETE"]);
}

