import { Database } from "@/types/supabase";

/**
 * Address Types
 * Extracted from Supabase schema
 */

// ============================================================================
// Database Types (from Supabase)
// ============================================================================

/**
 * Address row type from database
 */
export type Address = Database["public"]["Tables"]["addresses"]["Row"];

/**
 * Address insert type for creating new records
 */
export type AddressInsert = Database["public"]["Tables"]["addresses"]["Insert"];

/**
 * Address update type for updating existing records
 */
export type AddressUpdate = Database["public"]["Tables"]["addresses"]["Update"];

/**
 * Address type enum from Supabase
 */
export type AddressType = Database["public"]["Enums"]["address_type"];

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Address count information for limit enforcement
 */
export interface AddressCountInfo {
  currentCount: number;
  maxCount: number;
  canCreate: boolean;
  isNearLimit: boolean; // true when currentCount >= 4
}

/**
 * Address API response structure
 */
export interface AddressResponse {
  address: Address;
}

/**
 * Address list API response structure
 */
export interface AddressListResponse {
  addresses: Address[];
  total?: number;
  countInfo: AddressCountInfo; // New field for address count information
}

/**
 * Address limit error structure for specific error handling
 */
export interface AddressLimitError {
  code: "ADDRESS_LIMIT_EXCEEDED";
  message: string;
  currentCount: number;
  maxCount: number;
}

/**
 * Simplified address for default/primary display
 * Used in browse responses where full address details aren't needed
 */
export interface UserDefaultAddress {
  id: string;
  label: string | null;
  street_number: string | null;
  street_name: string;
  city: string;
  state: string;
  postal_code: string;
  latitude: number;
  longitude: number;
}

