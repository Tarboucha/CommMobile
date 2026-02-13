import { NextRequest } from "next/server";
import { withAuth } from "@/lib/utils/api-route-helper";
import { successResponse, handleUnsupportedMethod, ApiErrors } from "@/lib/utils/api-response";
import { createClient } from "@/lib/supabase/server";
import { addressSchema, type AddressInput } from "@/lib/validations/address";
import type { AddressListResponse, AddressResponse } from "@/types/address";
import type { AddressInsert } from "@/types/address";
import { geocodeAddressFromInput, RateLimiterTimeoutError } from "@/lib/utils/nominatim";
import { getAddressCountInfo, MAX_ADDRESSES_PER_USER } from "@/lib/utils/address-helpers";

/**
 * GET /api/addresses
 * List all addresses for current authenticated user
 * Returns only active (non-deleted) addresses with count information
 */
export const GET = withAuth(async (user, _request: NextRequest) => {
  const supabase = await createClient();

  // Get addresses and count info in parallel for better performance
  const [addressesResult, countInfo] = await Promise.all([
    supabase
      .from("addresses")
      .select("*")
      .eq("profile_id", user.id)
      .is("deleted_at", null)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false }),
    getAddressCountInfo(user.id)
  ]);

  if (addressesResult.error) {
    console.error("Failed to fetch addresses:", addressesResult.error);
    return ApiErrors.serverError();
  }

  return successResponse<AddressListResponse>({
    addresses: addressesResult.data || [],
    total: addressesResult.data?.length || 0,
    countInfo,
  });
});

/**
 * POST /api/addresses
 * Create a new address for the current authenticated user
 * Handles is_default logic: if setting is_default=true, sets other addresses to false
 * Enforces address limit (maximum 5 addresses per user)
 */
export const POST = withAuth(async (user, request) => {
  // Parse request body
  let rawData: Record<string, any>;
  try {
    rawData = await request.json();
  } catch (error) {
    return ApiErrors.badRequest("Invalid JSON in request body");
  }

  // Check address limit BEFORE processing (to avoid unnecessary geocoding)
  const countInfo = await getAddressCountInfo(user.id);
  
  if (!countInfo.canCreate) {
    return ApiErrors.conflict(
      `Address limit exceeded. You can have a maximum of ${MAX_ADDRESSES_PER_USER} addresses. You currently have ${countInfo.currentCount}. Please delete an existing address before adding a new one.`
    );
  }

  // Ensure profile_id matches authenticated user
  rawData.profile_id = user.id;

  // Geocode address using Nominatim API
  // This validates the address and returns normalized data
  let geocodedAddress;
  try {
    // Build geocoding params, only including street_number if it has a value
    const geocodingParams: Parameters<typeof geocodeAddressFromInput>[0] = {
      street_name: rawData.street_name,
      city: rawData.city,
      state: rawData.state,
      postal_code: rawData.postal_code,
      country: rawData.country,
    };
    // Only include street_number if it's provided and not empty
    if (rawData.street_number && rawData.street_number.trim() !== "") {
      geocodingParams.street_number = rawData.street_number;
    }
    
    geocodedAddress = await geocodeAddressFromInput(geocodingParams);

    if (!geocodedAddress) {
      return ApiErrors.badRequest(
        "Address could not be geocoded. Please check and correct your address."
      );
    }
  } catch (error) {
    console.error("[Address POST] Geocoding error:", error);
    
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

  // Merge geocoded address data with user input
  // Use geocoded data for address fields, keep user input for metadata
  const mergedData = {
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
    // apartment_unit, label, delivery_instructions, address_type, is_default, is_active remain from rawData
  };

  // Validate merged data with addressSchema
  const validation = addressSchema.safeParse(mergedData);
  if (!validation.success) {
    const firstError = validation.error.issues[0];
    return ApiErrors.badRequest(firstError.message);
  }

  const addressData: AddressInput = validation.data;

  // Prepare insert data - validation already normalized empty strings to null
  const insertData: AddressInsert = {
    ...addressData,
    state: addressData.state || "", // Ensure state is always a string (required by DB)
    // Latitude and longitude are guaranteed to be numbers from geocoding
    latitude: addressData.latitude!,
    longitude: addressData.longitude!,
    is_default: addressData.is_default ?? false,
    is_active: addressData.is_active ?? true,
  };

  const supabase = await createClient();

  // If setting this address as default, unset other default addresses
  if (insertData.is_default) {
    const { error: updateError } = await supabase
      .from("addresses")
      .update({ is_default: false })
      .eq("profile_id", user.id)
      .is("deleted_at", null);

    if (updateError) {
      console.error("Failed to unset other default addresses:", updateError);
      return ApiErrors.serverError();
    }
  }

  // Insert new address
  const { data: newAddress, error: insertError } = await supabase
    .from("addresses")
    .insert(insertData)
    .select()
    .single();

  if (insertError) {
    console.error("Failed to create address:", insertError);
    return ApiErrors.serverError();
  }

  return successResponse<AddressResponse>(
    {
      address: newAddress,
    },
    undefined,
    201
  );
});

// Catch unsupported methods
export async function PUT() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function PATCH() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

export async function DELETE() {
  return handleUnsupportedMethod(["GET", "POST"]);
}

