import { prisma } from "@/lib/prisma";

export const MAX_ADDRESSES_PER_USER = 5;

export interface AddressCountInfo {
  currentCount: number;
  maxCount: number;
  canCreate: boolean;
  isNearLimit: boolean; // true when currentCount === 4 (exactly 4 addresses)
}

/**
 * Get the count of active (non-deleted) addresses for a user
 * @param userId - The profile ID of the user
 * @returns Promise<number> - The count of active addresses
 */
export async function getActiveAddressCount(userId: string): Promise<number> {
  const count = await prisma.addresses.count({
    where: { profile_id: userId, deleted_at: null },
  });

  return count;
}

/**
 * Get comprehensive address count information for a user
 * @param userId - The profile ID of the user
 * @returns Promise<AddressCountInfo> - Complete count information
 */
export async function getAddressCountInfo(userId: string): Promise<AddressCountInfo> {
  const currentCount = await getActiveAddressCount(userId);
  
  return {
    currentCount,
    maxCount: MAX_ADDRESSES_PER_USER,
    canCreate: currentCount < MAX_ADDRESSES_PER_USER,
    isNearLimit: currentCount === MAX_ADDRESSES_PER_USER - 1, // Only true when exactly 4 addresses
  };
}

/**
 * Check if a user can create a new address
 * @param userId - The profile ID of the user
 * @returns Promise<boolean> - Whether the user can create a new address
 */
export async function canCreateAddress(userId: string): Promise<boolean> {
  const currentCount = await getActiveAddressCount(userId);
  return currentCount < MAX_ADDRESSES_PER_USER;
}
