import { Platform, Linking } from 'react-native';

/**
 * Open Google Maps or Apple Maps with coordinates
 * Automatically detects platform and opens the appropriate maps app
 * 
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @param label - Optional label for the location
 */
export async function openMapsLink(
  latitude: number | null,
  longitude: number | null,
  label?: string
): Promise<void> {
  if (!latitude || !longitude) {
    return;
  }

  const coords = `${latitude},${longitude}`;
  const encodedLabel = label ? encodeURIComponent(label) : '';

  let url: string;

  if (Platform.OS === 'ios') {
    // Apple Maps
    url = `maps://app?daddr=${coords}&q=${encodedLabel}`;
  } else {
    // Google Maps
    url = `geo:0,0?q=${coords}(${encodedLabel})`;
  }

  try {
    const supported = await Linking.canOpenURL(url);
    
    if (supported) {
      await Linking.openURL(url);
    } else {
      // Fallback to browser-based Google Maps
      const browserUrl = `https://www.google.com/maps/search/?api=1&query=${coords}`;
      await Linking.openURL(browserUrl);
    }
  } catch (error) {
    // Final fallback: open in browser
    const browserUrl = `https://www.google.com/maps/search/?api=1&query=${coords}`;
    await Linking.openURL(browserUrl);
  }
}

/**
 * Check if coordinates are valid
 */
export function hasValidCoordinates(
  latitude: number | null,
  longitude: number | null
): boolean {
  return (
    latitude !== null &&
    longitude !== null &&
    !isNaN(latitude) &&
    !isNaN(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}
