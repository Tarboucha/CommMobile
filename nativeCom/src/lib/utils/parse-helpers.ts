/**
 * Parse JSON array safely
 * Handles both JSON strings and already-parsed arrays
 */
export function parseJsonArray<T = unknown>(data: unknown): T[] {
  if (!data) return [];
  if (Array.isArray(data)) return data as T[];
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Tag object with possible nested structures
 */
interface TagObject {
  tag_name?: string;
  name?: string;
  display_name?: string;
  label?: string;
  icon_emoji?: string | null;
  icon?: string | null;
  emoji?: string | null;
  tag?: TagObject;
  dietary_tag?: TagObject;
  allergen_tag?: TagObject;
  cuisine_tag?: TagObject;
  cuisine_types_lookup?: TagObject;
}

/**
 * Extract tag name from tag object or string
 * Handles both { tag_name: "..." } objects and plain strings
 */
export function extractTagName(tag: unknown): string {
  if (!tag) return '';
  if (typeof tag === 'string') return tag;
  if (typeof tag === 'object' && tag !== null) {
    const t = tag as TagObject;
    // Try different possible field names for tag data
    if (t.tag_name) return t.tag_name;
    if (t.name) return t.name;
    if (t.display_name) return t.display_name;

    // Handle nested tag objects (e.g., { tag: { tag_name: "..." } })
    if (t.tag && typeof t.tag === 'object') {
      if (t.tag.tag_name) return t.tag.tag_name;
      if (t.tag.name) return t.tag.name;
      if (t.tag.display_name) return t.tag.display_name;
    }

    // Handle nested structures for dietary/allergen/cuisine tags
    if (t.dietary_tag && typeof t.dietary_tag === 'object') {
      if (t.dietary_tag.tag_name) return t.dietary_tag.tag_name;
      if (t.dietary_tag.name) return t.dietary_tag.name;
    }
    if (t.allergen_tag && typeof t.allergen_tag === 'object') {
      if (t.allergen_tag.tag_name) return t.allergen_tag.tag_name;
      if (t.allergen_tag.name) return t.allergen_tag.name;
    }
    if (t.cuisine_tag && typeof t.cuisine_tag === 'object') {
      if (t.cuisine_tag.tag_name) return t.cuisine_tag.tag_name;
      if (t.cuisine_tag.name) return t.cuisine_tag.name;
    }
  }

  return '';
}

/**
 * Extract tag names from JSON array
 * Safely parses JSON and extracts display names
 */
export function extractTagNames(jsonData: unknown): string[] {
  const tags = parseJsonArray(jsonData);
  return tags.map(extractTagName).filter(Boolean);
}

/**
 * Tag with icon data structure
 */
export interface TagWithIcon {
  name: string;
  icon: string | null;
}

/**
 * Extract tag name and icon from tag object
 * Returns both display_name and icon_emoji from database
 */
export function extractTagWithIcon(tag: unknown): TagWithIcon | null {
  if (!tag) return null;

  // Handle plain string (no icon available)
  if (typeof tag === 'string') {
    return { name: tag, icon: null };
  }

  if (typeof tag === 'object' && tag !== null) {
    const t = tag as TagObject;
    let name = '';
    let icon: string | null = null;

    // Extract name from various possible field names
    // Priority order: label (from API), display_name, tag_name, name
    if (t.label) name = t.label;
    else if (t.display_name) name = t.display_name;
    else if (t.tag_name) name = t.tag_name;
    else if (t.name) name = t.name;

    // Extract icon_emoji
    if (t.icon_emoji) icon = t.icon_emoji;
    else if (t.icon) icon = t.icon;
    else if (t.emoji) icon = t.emoji;

    // Handle nested tag objects (e.g., { cuisine_types_lookup: { ... } })
    if (!name && t.cuisine_types_lookup && typeof t.cuisine_types_lookup === 'object') {
      name = t.cuisine_types_lookup.label || t.cuisine_types_lookup.display_name || t.cuisine_types_lookup.name || '';
      icon = t.cuisine_types_lookup.icon_emoji || t.cuisine_types_lookup.icon || null;
    }

    // Handle other nested structures
    if (!name && t.tag && typeof t.tag === 'object') {
      name = t.tag.label || t.tag.display_name || t.tag.tag_name || t.tag.name || '';
      icon = t.tag.icon_emoji || t.tag.icon || null;
    }

    if (name) {
      return { name, icon };
    }
  }

  return null;
}

/**
 * Extract tags with icons from JSON array
 * Safely parses JSON and extracts display names with icons
 */
export function extractTagsWithIcons(jsonData: unknown): TagWithIcon[] {
  const tags = parseJsonArray(jsonData);
  return tags
    .map(extractTagWithIcon)
    .filter((tag): tag is TagWithIcon => tag !== null && tag.name.length > 0);
}
