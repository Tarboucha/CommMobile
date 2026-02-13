import { Linking } from 'react-native';
import type { AddressCountInfo } from '@/types/address';

/**
 * Address UI Helper Utilities
 * Icons, labels, maps integration, and count indicators for React Native
 */

/**
 * Get Ionicons icon name for address type
 * @param addressType Address type: home, work, other
 * @returns Ionicons icon name
 */
export function getAddressTypeIcon(
  addressType: 'home' | 'work' | 'other'
): string {
  switch (addressType) {
    case 'home':
      return 'home-outline';
    case 'work':
      return 'briefcase-outline';
    case 'other':
    default:
      return 'ellipsis-horizontal-outline';
  }
}

/**
 * Get human-readable label for address type
 * @param addressType Address type: home, work, other
 * @returns Label string
 */
export function getAddressTypeLabel(
  addressType: 'home' | 'work' | 'other'
): string {
  switch (addressType) {
    case 'home':
      return 'Home';
    case 'work':
      return 'Work';
    case 'other':
    default:
      return 'Other';
  }
}

/**
 * Open address in Google Maps app (native app preferred, web fallback)
 * @param latitude Latitude coordinate
 * @param longitude Longitude coordinate
 * @returns Promise that resolves when Maps is opened
 * @throws Error if unable to open maps
 */
export async function openAddressInMaps(
  latitude: number,
  longitude: number
): Promise<void> {
  // Try native Google Maps app URLs first
  const nativeUrls = [
    `comgooglemaps://?q=${latitude},${longitude}`, // iOS Google Maps
    `geo:${latitude},${longitude}?q=${latitude},${longitude}`, // Android
  ];

  // Try native apps first
  for (const url of nativeUrls) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
        return;
      }
    } catch (error) {
      // Continue to next URL
    }
  }

  // Fallback to web URL
  const webUrl = `https://maps.google.com/?q=${latitude},${longitude}`;
  try {
    const supported = await Linking.canOpenURL(webUrl);
    if (supported) {
      await Linking.openURL(webUrl);
    } else {
      throw new Error('Unable to open maps - URL not supported');
    }
  } catch (error) {
    throw error;
  }
}

/**
 * Get color indicator for address count
 * @param countInfo Address count information
 * @returns Color type: 'success' | 'warning' | 'error'
 */
export function getAddressCountColor(
  countInfo: AddressCountInfo
): 'success' | 'warning' | 'error' {
  const { currentCount, maxCount } = countInfo;

  if (currentCount >= maxCount) {
    return 'error'; // Red - limit reached (5/5)
  } else if (currentCount >= maxCount - 1) {
    return 'warning'; // Yellow - almost at limit (4/5)
  } else {
    return 'success'; // Green - safe (0-3/5)
  }
}

/**
 * Get helper message for address count indicator
 * @param countInfo Address count information
 * @returns Helpful message string
 */
export function getAddressCountMessage(countInfo: AddressCountInfo): string {
  const { currentCount, maxCount, canCreate } = countInfo;

  if (!canCreate) {
    return `Maximum of ${maxCount} addresses reached. Delete one to add a new address.`;
  } else if (currentCount >= maxCount - 1) {
    const remaining = maxCount - currentCount;
    return `Almost at limit! You have ${remaining} address slot${remaining !== 1 ? 's' : ''} remaining.`;
  } else {
    const remaining = maxCount - currentCount;
    return `You can add ${remaining} more address${remaining !== 1 ? 'es' : ''}.`;
  }
}
