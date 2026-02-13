import { fetchAPI } from '@/lib/api/client';
import type {
  Address,
  AddressListResponse,
  AddressResponse,
  AddressCountInfo,
} from '@/types/address';
import type { AddressInput, AddressUpdateInput } from '@/lib/validations/address';

/**
 * Address API Client
 * Handles all address-related API calls
 */

/**
 * Get all addresses for the current user
 * @returns Promise with addresses array and count info
 */
export async function getAddresses(): Promise<{
  addresses: Address[];
  countInfo: AddressCountInfo;
}> {
  const response = await fetchAPI<{ success: boolean; data: AddressListResponse }>('/api/addresses', {
    method: 'GET',
  });

  return {
    addresses: response.data.addresses,
    countInfo: response.data.countInfo,
  };
}

/**
 * Create a new address
 * Note: Do NOT send latitude/longitude - they are added by backend via geocoding
 * @param data Address data without coordinates
 * @returns Promise with created address
 */
export async function createAddress(
  data: Omit<AddressInput, 'latitude' | 'longitude' | 'profile_id'>
): Promise<Address> {
  const response = await fetchAPI<{ success: boolean; data: AddressResponse }>('/api/addresses', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.data.address;
}

/**
 * Update an existing address
 * @param addressId Address ID
 * @param data Partial address data to update. Also accepts `is_business_address`
 *   which is an API-only flag (not a DB column) to set this address as the chef's business address.
 * @returns Promise with updated address
 */
export async function updateAddress(
  addressId: string,
  data: Partial<AddressUpdateInput> & { is_business_address?: boolean }
): Promise<Address> {
  const response = await fetchAPI<{ success: boolean; data: AddressResponse }>(
    `/api/addresses/${addressId}`,
    {
      method: 'PATCH',
      body: JSON.stringify(data),
    }
  );

  return response.data.address;
}

/**
 * Delete an address (soft delete)
 * @param addressId Address ID
 * @returns Promise that resolves when deleted
 */
export async function deleteAddress(addressId: string): Promise<void> {
  await fetchAPI(`/api/addresses/${addressId}`, {
    method: 'DELETE',
  });
}

/**
 * Set an address as the default address
 * This is a convenience function that calls updateAddress with is_default: true
 * @param addressId Address ID
 * @returns Promise with updated address
 */
export async function setDefaultAddress(addressId: string): Promise<Address> {
  return updateAddress(addressId, { is_default: true });
}
