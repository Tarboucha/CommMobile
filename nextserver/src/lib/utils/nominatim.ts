/**
 * Nominatim Geocoding Service
 * 
 * Provides geocoding functionality using the Nominatim API with:
 * - Global rate limiting (1 request per second)
 * - Structured address search
 * - Reverse geocoding
 * - Response parsing and normalization
 * 
 * @see NOMINATIM.md for API usage guidelines
 */

// ============================================================================
// Custom Errors
// ============================================================================

/**
 * Custom error for rate limiter timeouts
 * This distinguishes rate limiting delays from actual geocoding failures
 */
export class RateLimiterTimeoutError extends Error {
  constructor(message: string = "Request timed out while waiting in rate limiter queue") {
    super(message);
    this.name = "RateLimiterTimeoutError";
  }
}

// ============================================================================
// Types
// ============================================================================

export interface NominatimSearchParams {
  street?: string;
  city?: string;
  state?: string;
  postalcode?: string;
  country?: string;
}

export interface NominatimReverseParams {
  lat: number;
  lon: number;
  zoom?: number;
}

export interface GeocodedAddress {
  street_number?: string; // Optional - omitted when Nominatim doesn't provide housenumber
  street_name: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
  latitude: number;
  longitude: number;
  // Optional fields
  apartment_unit?: string | null;
}

interface NominatimGeocodeJsonResponse {
  type: "FeatureCollection";
  geocoding?: {
    version?: string;
    attribution?: string;
    licence?: string;
    query?: string;
  };
  features: Array<{
    type: "Feature";
    geometry: {
      type: "Point";
      coordinates: [number, number]; // [longitude, latitude]
    };
    properties: {
      geocoding: {
        place_id?: number;
        osm_type?: string;
        osm_id?: number;
        type?: string;
        label?: string;
        name?: string;
        housenumber?: string;
        street?: string;
        locality?: string;
        postcode?: string;
        city?: string;
        state?: string;
        region?: string;
        country?: string;
        country_code?: string;
      };
    };
  }>;
}

// ==================================================== ========================
// Configuration
// ============================================================================

const NOMINATIM_BASE_URL = "https://nominatim.openstreetmap.org";
const MIN_INTERVAL_MS = 2000; // 1 second between requests (as per Nominatim policy)
const MAX_QUEUE_WAIT_MS = 10000; // In case run on edge/serverless function
const USER_AGENT = "CommunityChef/1.0 (contact@communitychef.app)";
const CONTACT_EMAIL = "contact@communitychef.app";

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Queue-based rate limiter for Nominatim API
 * Ensures we never exceed 1 request per second globally
 */
class NominatimRateLimiter {
  private requestQueue: Array<{
    resolve: (value: void) => void;
    reject: (error: Error) => void;
    queuedAt: number;
  }> = [];
  private isProcessing = false;
  private lastRequestTime = 0;
  private requestCounter = 0;

  /**
   * Wait for rate limit, then execute request
   */
  async waitForRateLimit(): Promise<void> {
    const requestId = ++this.requestCounter;
    const queuedAt = Date.now();
    const queuePosition = this.requestQueue.length + 1;

    return new Promise((resolve, reject) => {
      // Log queue status
      if (queuePosition > 1) {
        console.log(`[Nominatim Rate Limiter] Request #${requestId} queued. Position in queue: ${queuePosition}, Queue size: ${this.requestQueue.length + 1}`);
      }

      // Set up timeout to prevent infinite waiting
      const timeoutId = setTimeout(() => {
        // Remove from queue if still waiting
        const index = this.requestQueue.findIndex(item => item.queuedAt === queuedAt);
        if (index !== -1) {
          this.requestQueue.splice(index, 1);
          console.error(`[Nominatim Rate Limiter] Request #${requestId} timed out after ${MAX_QUEUE_WAIT_MS}ms`);
          reject(new RateLimiterTimeoutError(`Request timed out after ${MAX_QUEUE_WAIT_MS}ms in rate limiter queue`));
        }
      }, MAX_QUEUE_WAIT_MS);

      this.requestQueue.push({ 
        resolve: () => {
          clearTimeout(timeoutId);
          resolve();
        },
        reject: (error: Error) => {
          clearTimeout(timeoutId);
          reject(error);
        },
        queuedAt,
      });
      
      this.processQueue();
    });
  }

  /**
   * Process queue, ensuring 1 second between requests
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      // Wait if needed to maintain 1 second interval
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      if (timeSinceLastRequest < MIN_INTERVAL_MS) {
        const waitTime = MIN_INTERVAL_MS - timeSinceLastRequest;
        const queueSize = this.requestQueue.length;
        
        if (queueSize > 0) {
          const nextRequest = this.requestQueue[0];
          const waitTimeSeconds = (waitTime / 1000).toFixed(1);
          console.log(`[Nominatim Rate Limiter] Rate limiting active. Waiting ${waitTimeSeconds}s before next request. Queue size: ${queueSize}`);
        }
        
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }

      // Process next request
      const next = this.requestQueue.shift();
      if (next) {
        const waitTime = Date.now() - next.queuedAt;
        const waitTimeSeconds = (waitTime / 1000).toFixed(1);
        
        if (waitTime > 100) {
          // Only log if there was a noticeable wait
          console.log(`[Nominatim Rate Limiter] Processing request after ${waitTimeSeconds}s wait. Remaining in queue: ${this.requestQueue.length}`);
        }
        
        this.lastRequestTime = Date.now();
        next.resolve();
      }
    } catch (error) {
      // Handle any errors in queue processing
      console.error("[Nominatim Rate Limiter] Error processing queue:", error);
      // Reject the next request if there's an error
      const next = this.requestQueue.shift();
      if (next) {
        next.reject(error instanceof Error ? error : new Error("Rate limiter error"));
      }
    } finally {
      this.isProcessing = false;

      // Process next item in queue
      if (this.requestQueue.length > 0) {
        // Small delay to ensure we maintain rate limit
        setTimeout(() => this.processQueue(), 10);
      }
    }
  }

  /**
   * Get current queue status (for debugging)
   */
  getQueueStatus() {
    return {
      queueSize: this.requestQueue.length,
      isProcessing: this.isProcessing,
      timeSinceLastRequest: this.lastRequestTime > 0 ? Date.now() - this.lastRequestTime : 0,
    };
  }
}

// Global rate limiter instance
const rateLimiter = new NominatimRateLimiter();

// ============================================================================
// API Request Helpers
// ============================================================================

/**
 * Make a rate-limited request to Nominatim API
 */
async function makeNominatimRequest(url: string): Promise<Response> {
  try {
    // Wait for rate limit (this will queue the request if needed)
    await rateLimiter.waitForRateLimit();

    // Make the actual API request
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
      },
    });

    return response;
  } catch (error) {
    // Log rate limiter errors
    console.error("[Nominatim] Rate limiter error:", error);
    throw error;
  }
}

/**
 * Build search URL with parameters
 */
function buildSearchUrl(params: NominatimSearchParams): string {
  const url = new URL(`${NOMINATIM_BASE_URL}/search`);
  
  // Required parameters
  url.searchParams.set("format", "geocodejson");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  
  // Optional parameters
  if (params.street) {
    url.searchParams.set("street", params.street);
  }
  if (params.city) {
    url.searchParams.set("city", params.city);
  }
  if (params.state) {
    url.searchParams.set("state", params.state);
  }
  if (params.postalcode) {
    url.searchParams.set("postalcode", params.postalcode);
  }
  if (params.country) {
    url.searchParams.set("country", params.country);
  }
  
  // Recommended parameters
  url.searchParams.set("email", CONTACT_EMAIL);
  
  return url.toString();
}

/**
 * Build reverse geocoding URL with parameters
 */
function buildReverseUrl(params: NominatimReverseParams): string {
  const url = new URL(`${NOMINATIM_BASE_URL}/reverse`);
  
  // Required parameters
  url.searchParams.set("lat", params.lat.toString());
  url.searchParams.set("lon", params.lon.toString());
  url.searchParams.set("format", "geocodejson");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("limit", "1");
  
  // Optional parameters
  if (params.zoom) {
    url.searchParams.set("zoom", params.zoom.toString());
  } else {
    // Default to 18 for address-level detail
    url.searchParams.set("zoom", "18");
  }
  
  // Recommended parameters
  url.searchParams.set("email", CONTACT_EMAIL);
  
  return url.toString();
}

// ============================================================================
// Response Parsing
// ============================================================================

/**
 * Parse geocodejson response and extract address data
 */
function parseGeocodeJsonResponse(
  response: NominatimGeocodeJsonResponse
): GeocodedAddress | null {
  // Validate response structure
  if (!response.features || response.features.length === 0) {
    console.error("[Nominatim] No features in response");
    return null;
  }

  const feature = response.features[0];
  const geocoding = feature.properties?.geocoding;

  if (!geocoding) {
    console.error("[Nominatim] No geocoding property in feature:", {
      hasProperties: !!feature.properties,
      propertiesKeys: feature.properties ? Object.keys(feature.properties) : [],
    });
    return null;
  }

  if (!feature.geometry?.coordinates) {
    console.error("[Nominatim] No coordinates in feature geometry");
    return null;
  }

  // Extract coordinates (GeoJSON format: [longitude, latitude])
  const [longitude, latitude] = feature.geometry.coordinates;

  // Validate coordinates
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    console.error("[Nominatim] Invalid coordinates:", { latitude, longitude });
    return null;
  }

  // Extract address fields with fallbacks
  // Note: When there's no housenumber, Nominatim may return street name in 'name' field
  const streetNumber = geocoding.housenumber; // Only include if provided by Nominatim
  const streetName = geocoding.street || geocoding.name || "";
  const city = geocoding.city || geocoding.locality || "";
  const state = geocoding.state || geocoding.region || "";
  const postalCode = geocoding.postcode || "";
  const country = geocoding.country || "";

  // Validate required fields
  if (!streetName || !city || !country) {
    console.error("[Nominatim] Missing required address fields:", {
      streetName,
      city,
      country,
      geocodingData: {
        street: geocoding.street,
        name: geocoding.name,
        city: geocoding.city,
        locality: geocoding.locality,
        country: geocoding.country,
      },
    });
    return null;
  }

  // Build result object, only including street_number if provided by Nominatim
  const result: GeocodedAddress = {
    street_name: streetName,
    city,
    state,
    postal_code: postalCode,
    country,
    latitude,
    longitude,
    apartment_unit: null, // Nominatim doesn't provide apartment units
  };

  // Only include street_number if Nominatim provided it
  if (streetNumber) {
    result.street_number = streetNumber;
  }

  return result;
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Search for an address using structured parameters
 * Returns normalized address data from Nominatim API
 * 
 * @param params - Address components to search for
 * @returns Geocoded address or null if not found
 */
export async function searchAddress(
  params: NominatimSearchParams
): Promise<GeocodedAddress | null> {
  try {
    // Build search URL
    const url = buildSearchUrl(params);

    // Make rate-limited request (this will queue if needed)
    const response = await makeNominatimRequest(url);

    // Handle HTTP errors
    if (response.status === 429) {
      console.error("[Nominatim] Rate limit exceeded (429) - This should not happen with our rate limiter");
      // Wait a bit longer and retry once (with rate limiting)
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const retryResponse = await makeNominatimRequest(url);
      if (!retryResponse.ok) {
        throw new Error(`Nominatim API error: ${retryResponse.status}`);
      }
      const retryData = await retryResponse.json();
      return parseGeocodeJsonResponse(retryData);
    }

    if (response.status === 503) {
      console.error("[Nominatim] Service unavailable (503)");
      throw new Error("Geocoding service temporarily unavailable");
    }

    if (!response.ok) {
      console.error("[Nominatim] API error:", response.status, response.statusText);
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    // Parse response
    const data: NominatimGeocodeJsonResponse = await response.json();
    return parseGeocodeJsonResponse(data);
  } catch (error) {
    // Log error but don't expose internal details
    console.error("[Nominatim] Search error:", error);
    
    // Re-throw as user-friendly error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to geocode address");
  }
}

/**
 * Reverse geocode coordinates to get address
 * Returns normalized address data from Nominatim API
 * 
 * @param params - Latitude and longitude
 * @returns Geocoded address or null if not found
 */
export async function reverseGeocode(
  params: NominatimReverseParams
): Promise<GeocodedAddress | null> {
  try {
    // Build reverse URL
    const url = buildReverseUrl(params);

    // Make rate-limited request (this will queue if needed)
    const response = await makeNominatimRequest(url);

    // Handle HTTP errors
    if (response.status === 429) {
      console.error("[Nominatim] Rate limit exceeded (429) - This should not happen with our rate limiter");
      // Wait a bit longer and retry once (with rate limiting)
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const retryResponse = await makeNominatimRequest(url);
      if (!retryResponse.ok) {
        throw new Error(`Nominatim API error: ${retryResponse.status}`);
      }
      const retryData = await retryResponse.json();
      return parseGeocodeJsonResponse(retryData);
    }

    if (response.status === 503) {
      console.error("[Nominatim] Service unavailable (503)");
      throw new Error("Geocoding service temporarily unavailable");
    }

    if (!response.ok) {
      console.error("[Nominatim] API error:", response.status, response.statusText);
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    // Parse response
    const data: NominatimGeocodeJsonResponse = await response.json();
    return parseGeocodeJsonResponse(data);
  } catch (error) {
    // Log error but don't expose internal details
    console.error("[Nominatim] Reverse geocode error:", error);
    
    // Re-throw as user-friendly error
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Failed to reverse geocode coordinates");
  }
}

/**
 * Search for an address using user input fields
 * Convenience function that builds search params from address form data
 * 
 * @param addressData - Address data from user input
 * @returns Geocoded address or null if not found
 */
export async function geocodeAddressFromInput(
  addressData: {
    street_number?: string;
    street_name?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  }
): Promise<GeocodedAddress | null> {
  // Build street parameter (combine street_number and street_name)
  let street: string | undefined;
  if (addressData.street_number && addressData.street_name) {
    street = `${addressData.street_number} ${addressData.street_name}`.trim();
  } else if (addressData.street_name) {
    street = addressData.street_name;
  }

  // Build search parameters
  const searchParams: NominatimSearchParams = {};
  
  if (street) {
    searchParams.street = street;
  }
  if (addressData.city) {
    searchParams.city = addressData.city;
  }
  if (addressData.state) {
    searchParams.state = addressData.state;
  }
  if (addressData.postal_code) {
    searchParams.postalcode = addressData.postal_code;
  }
  if (addressData.country) {
    searchParams.country = addressData.country;
  }

  return searchAddress(searchParams);
}

