import type { addresses, address_type, Prisma } from "@/generated/prisma/client";
import type { AddressCountInfo } from "@/lib/utils/address-helpers";

/**
 * Address types extracted from the Prisma schema.
 */

// ============================================================================
// Database Types
// ============================================================================

export type Address = addresses;
export type AddressInsert = Prisma.addressesUncheckedCreateInput;
export type AddressUpdate = Prisma.addressesUncheckedUpdateInput;
export type AddressType = address_type;

// Visibility: 'private' (default) | 'offering_pickup'
export type AddressVisibility = "private" | "offering_pickup";

// ============================================================================
// API Response Types
// ============================================================================

export interface AddressResponse {
  address: Address;
}

export interface AddressListResponse {
  addresses: Address[];
  total: number;
  countInfo: AddressCountInfo;
}
