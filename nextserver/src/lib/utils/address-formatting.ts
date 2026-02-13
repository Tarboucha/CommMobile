/**
 * Address formatting utilities for consistent address display
 * Used with active_chef_catalog view data that includes complete address information
 */

export interface AddressComponents {
  street_name?: string | null;
  street_number?: string | null;
  apartment_unit?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
  address_latitude?: number | null;
  address_longitude?: number | null;
}

/**
 * Formats a complete address for display
 * Format: [Street Number] [Street Name][, Apt/Unit][, City, State Postal Code, Country]
 * 
 * Examples:
 * - "123 Main Street, New York, NY 10001, USA"
 * - "456 Oak Avenue, Apt 2B, Los Angeles, CA 90210, USA"
 * - "789 Pine Road, Toronto, ON M5V 3A8, Canada"
 */
export function formatFullAddress(address: AddressComponents): string {
  const parts: string[] = [];
  
  // Street address - name first, then number
  const streetParts: string[] = [];
  if (address.street_name) streetParts.push(address.street_name);
  if (address.street_number) streetParts.push(address.street_number);
  
  
  if (streetParts.length > 0) {
    let streetAddress = streetParts.join(" ");
    if (address.apartment_unit) {
      streetAddress += `, ${address.apartment_unit}`;
    }
    parts.push(streetAddress);
  }
  
  // City, State Postal Code
  const cityStateParts: string[] = [];
  if (address.city) cityStateParts.push(address.city);
  
  const statePostal: string[] = [];
  if (address.state) statePostal.push(address.state);
  if (address.postal_code) statePostal.push(address.postal_code);
  
  if (statePostal.length > 0) {
    cityStateParts.push(statePostal.join(" "));
  }
  
  if (cityStateParts.length > 0) {
    parts.push(cityStateParts.join(", "));
  }
  
  // Country
  if (address.country) {
    parts.push(address.country);
  }
  
  return parts.length > 0 ? parts.join(", ") : "Address not specified";
}

/**
 * Formats a compact address for space-constrained displays
 * Prioritizes: City, State, Country for backwards compatibility
 * Falls back to street address if city/state unavailable
 */
export function formatCompactAddress(address: AddressComponents): string {
  // First try: City, State, Country (existing pattern)
  const cityStateParts: string[] = [];
  if (address.city) cityStateParts.push(address.city);
  if (address.state) cityStateParts.push(address.state);
  if (address.country) cityStateParts.push(address.country);
  
  if (cityStateParts.length > 0) {
    return cityStateParts.join(", ");
  }
  
  // Fallback: Street address if no city/state
  const streetParts: string[] = [];
  if (address.street_name) streetParts.push(address.street_name);
  if (address.street_number) streetParts.push(address.street_number);
  
  if (streetParts.length > 0) {
    return streetParts.join(" ");
  }
  
  return "Location not specified";
}

/**
 * Checks if address has valid coordinates for Google Maps integration
 * Handles multiple coordinate field name formats
 */
export function hasValidCoordinates(address: AddressComponents): boolean {
  // Check address_latitude/address_longitude format (active_chef_catalog)
  if (
    typeof address.address_latitude === "number" &&
    typeof address.address_longitude === "number" &&
    !isNaN(address.address_latitude) &&
    !isNaN(address.address_longitude) &&
    address.address_latitude >= -90 &&
    address.address_latitude <= 90 &&
    address.address_longitude >= -180 &&
    address.address_longitude <= 180
  ) {
    return true;
  }
  
  // Check latitude/longitude format (direct address)
  const directAddress = address as any;
  if (
    typeof directAddress.latitude === "number" &&
    typeof directAddress.longitude === "number" &&
    !isNaN(directAddress.latitude) &&
    !isNaN(directAddress.longitude) &&
    directAddress.latitude >= -90 &&
    directAddress.latitude <= 90 &&
    directAddress.longitude >= -180 &&
    directAddress.longitude <= 180
  ) {
    return true;
  }
  
  return false;
}

/**
 * Extracts coordinates from address data for Google Maps integration
 * Returns null if coordinates are invalid or missing
 * Handles multiple coordinate field name formats
 */
export function extractCoordinates(address: AddressComponents): { latitude: number; longitude: number } | null {
  if (!address) return null;
  
  const addressData = address as any;
  
  // List of possible coordinate field name combinations
  const coordinateFields = [
    // Standard formats
    { lat: 'address_latitude', lng: 'address_longitude' },
    { lat: 'latitude', lng: 'longitude' },
    // Possible variations
    { lat: 'lat', lng: 'lng' },
    { lat: 'lat', lng: 'lon' },
    { lat: 'address_lat', lng: 'address_lng' },
    { lat: 'business_latitude', lng: 'business_longitude' },
  ];
  
  // Try each coordinate field combination
  for (const fields of coordinateFields) {
    const lat = addressData[fields.lat];
    const lng = addressData[fields.lng];
    
    if (lat != null && lng != null) {
      const latitude = Number(lat);
      const longitude = Number(lng);
      
      if (!isNaN(latitude) && !isNaN(longitude) && 
          latitude >= -90 && latitude <= 90 && 
          longitude >= -180 && longitude <= 180) {
        return { latitude, longitude };
      }
    }
  }
  
  return null;
}

/**
 * Formats address for Google Maps search (fallback when coordinates unavailable)
 * Uses the most complete address information available
 */
export function formatAddressForMapsSearch(address: AddressComponents): string {
  // Try full address first
  const fullAddress = formatFullAddress(address);
  if (fullAddress !== "Address not specified") {
    return fullAddress;
  }
  
  // Fallback to compact address
  const compactAddress = formatCompactAddress(address);
  if (compactAddress !== "Location not specified") {
    return compactAddress;
  }
  
  return "";
}
