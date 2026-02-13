import type { ActiveChefCatalog } from '@/types/browse-chefs';

/**
 * Format full address from chef data
 * Returns a single-line formatted address string
 */
export function formatFullAddress(chef: ActiveChefCatalog): string {
  const parts: string[] = [];

  if (chef.street_name) parts.push(chef.street_name);
  if (chef.city) parts.push(chef.city);
  if (chef.state) parts.push(chef.state);
  if (chef.postal_code) parts.push(chef.postal_code);
  if (chef.country) parts.push(chef.country);

  return parts.join(', ');
}

/**
 * Format address for display (multi-line)
 * Returns address components for flexible UI rendering
 */
export function formatAddressComponents(chef: ActiveChefCatalog) {
  return {
    street: chef.street_name || '',
    city: chef.city || '',
    state: chef.state || '',
    postalCode: chef.postal_code || '',
    country: chef.country || '',
    fullAddress: formatFullAddress(chef),
  };
}

/**
 * Check if chef has valid address
 */
export function hasValidAddress(chef: ActiveChefCatalog): boolean {
  return Boolean(chef.street_name || chef.city);
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
