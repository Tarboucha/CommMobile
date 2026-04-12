import { prisma } from "@/lib/prisma";
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from "@/lib/errors/domain-errors";
import {
  geocodeAddressFromInput,
  RateLimiterTimeoutError,
} from "@/lib/utils/nominatim";
import {
  getAddressCountInfo,
  MAX_ADDRESSES_PER_USER,
} from "@/lib/utils/address-helpers";
import type { AddressInput } from "@/lib/validations/address";
import type { AddressInsert, AddressUpdate } from "@/types/address";

// ============================================================================
// Helpers
// ============================================================================

/**
 * Geocode address input and return normalized address data.
 * Throws ValidationError on geocoding failure.
 */
async function geocodeOrThrow(
  addressData: Parameters<typeof geocodeAddressFromInput>[0]
) {
  try {
    const geocoded = await geocodeAddressFromInput(addressData);

    if (!geocoded) {
      throw new ValidationError(
        "Address could not be geocoded. Please check and correct your address."
      );
    }

    return geocoded;
  } catch (error) {
    if (error instanceof ValidationError) throw error;

    if (error instanceof RateLimiterTimeoutError) {
      throw new ValidationError(
        "Geocoding request timed out. Please try again in a moment. The service is processing other requests."
      );
    }

    if (
      error instanceof Error &&
      error.message.includes("temporarily unavailable")
    ) {
      throw new ValidationError(
        "Geocoding service is temporarily unavailable. Please try again in a moment."
      );
    }

    throw new ValidationError(
      "Address could not be geocoded. Please check and correct your address."
    );
  }
}

// ============================================================================
// List addresses
// ============================================================================

export async function listAddresses(userId: string) {
  const [addresses, countInfo] = await Promise.all([
    prisma.addresses.findMany({
      where: { profile_id: userId, deleted_at: null },
      orderBy: [{ is_default: "desc" }, { created_at: "desc" }],
    }),
    getAddressCountInfo(userId),
  ]);

  return { addresses, total: addresses.length, countInfo };
}

// ============================================================================
// Get single address
// ============================================================================

export async function getAddress(addressId: string, userId: string) {
  const address = await prisma.addresses.findFirst({
    where: { id: addressId, deleted_at: null },
  });

  if (!address) throw new NotFoundError("Address");

  if (address.profile_id !== userId) {
    throw new ForbiddenError("You can only access your own addresses");
  }

  return address;
}

// ============================================================================
// Create address
// ============================================================================

export async function createAddress(
  userId: string,
  rawData: Record<string, any>,
  validatedData: AddressInput
) {
  // Check address limit
  const countInfo = await getAddressCountInfo(userId);
  if (!countInfo.canCreate) {
    throw new ConflictError(
      `Address limit exceeded. You can have a maximum of ${MAX_ADDRESSES_PER_USER} addresses. You currently have ${countInfo.currentCount}. Please delete an existing address before adding a new one.`
    );
  }

  // Build geocoding params
  const geocodingParams: Parameters<typeof geocodeAddressFromInput>[0] = {
    street_name: rawData.street_name,
    city: rawData.city,
    state: rawData.state,
    postal_code: rawData.postal_code,
    country: rawData.country,
  };
  if (rawData.street_number && rawData.street_number.trim() !== "") {
    geocodingParams.street_number = rawData.street_number;
  }

  const geocoded = await geocodeOrThrow(geocodingParams);

  // Prepare insert data using validated + geocoded data
  const insertData: AddressInsert = {
    ...validatedData,
    profile_id: userId,
    ...(geocoded.street_number && { street_number: geocoded.street_number }),
    street_name: geocoded.street_name,
    city: geocoded.city,
    state: geocoded.state || validatedData.state || "",
    postal_code: geocoded.postal_code,
    country: geocoded.country,
    latitude: geocoded.latitude,
    longitude: geocoded.longitude,
    is_default: validatedData.is_default ?? false,
    is_active: validatedData.is_active ?? true,
  };

  // If setting as default, unset other defaults
  if (insertData.is_default) {
    await prisma.addresses.updateMany({
      where: { profile_id: userId, deleted_at: null },
      data: { is_default: false },
    });
  }

  return prisma.addresses.create({ data: insertData });
}

// ============================================================================
// Update address
// ============================================================================

export async function updateAddress(
  addressId: string,
  userId: string,
  rawData: Record<string, any>,
  validatedData: Record<string, any>
) {
  const existingAddress = await prisma.addresses.findFirst({
    where: { id: addressId, deleted_at: null },
  });

  if (!existingAddress) throw new NotFoundError("Address");

  if (existingAddress.profile_id !== userId) {
    throw new ForbiddenError("You can only update your own addresses");
  }

  // Check if address fields are being updated
  const addressFields = [
    "street_number",
    "street_name",
    "city",
    "state",
    "postal_code",
    "country",
  ];
  const isAddressFieldUpdated = addressFields.some(
    (field) => field in rawData
  );

  let processedData: AddressUpdate = { ...validatedData } as AddressUpdate;

  // Geocode if address fields changed
  if (isAddressFieldUpdated) {
    const addressForGeocoding: Parameters<typeof geocodeAddressFromInput>[0] = {
      street_name:
        "street_name" in rawData
          ? rawData.street_name || existingAddress.street_name
          : existingAddress.street_name,
      city:
        "city" in rawData
          ? rawData.city || existingAddress.city
          : existingAddress.city,
      state:
        "state" in rawData && rawData.state && rawData.state !== ""
          ? rawData.state
          : undefined,
      postal_code:
        "postal_code" in rawData
          ? rawData.postal_code || existingAddress.postal_code
          : existingAddress.postal_code,
      country:
        "country" in rawData
          ? rawData.country || existingAddress.country
          : existingAddress.country,
    };

    // Handle street_number
    if ("street_number" in rawData) {
      if (rawData.street_number && rawData.street_number.trim() !== "") {
        addressForGeocoding.street_number = rawData.street_number;
      }
    } else if (existingAddress.street_number) {
      addressForGeocoding.street_number = existingAddress.street_number;
    }

    const geocoded = await geocodeOrThrow(addressForGeocoding);

    processedData = {
      ...processedData,
      ...(geocoded.street_number && {
        street_number: geocoded.street_number,
      }),
      street_name: geocoded.street_name,
      city: geocoded.city,
      state: geocoded.state,
      postal_code: geocoded.postal_code,
      country: geocoded.country,
      latitude: geocoded.latitude,
      longitude: geocoded.longitude,
    } as AddressUpdate;
  }

  // If setting is_default, unset other defaults
  if ((processedData).is_default === true) {
    await prisma.addresses.updateMany({
      where: {
        profile_id: existingAddress.profile_id,
        id: { not: addressId },
        deleted_at: null,
      },
      data: { is_default: false },
    });
  }

  return prisma.addresses.update({
    where: { id: addressId },
    data: { ...processedData, updated_at: new Date() },
  });
}

// ============================================================================
// Delete address (soft)
// ============================================================================

export async function deleteAddress(addressId: string, userId: string) {
  const existingAddress = await prisma.addresses.findFirst({
    where: { id: addressId, deleted_at: null },
  });

  if (!existingAddress) throw new NotFoundError("Address");

  if (existingAddress.profile_id !== userId) {
    throw new ForbiddenError("You can only delete your own addresses");
  }

  await prisma.addresses.update({
    where: { id: addressId },
    data: { deleted_at: new Date(), updated_at: new Date() },
  });
}
