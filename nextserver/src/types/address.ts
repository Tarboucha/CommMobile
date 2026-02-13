import { Database } from "@/types/supabase";
import type { AddressCountInfo } from "@/lib/utils/address-helpers";

/**
 * Address types extracted from Supabase schema
 */

// ============================================================================
// Database Types
// ============================================================================

export type Address = Database["public"]["Tables"]["addresses"]["Row"];
export type AddressInsert = Database["public"]["Tables"]["addresses"]["Insert"];
export type AddressUpdate = Database["public"]["Tables"]["addresses"]["Update"];
export type AddressType = Database["public"]["Enums"]["address_type"];

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
