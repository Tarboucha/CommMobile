// ============================================================================
// Offering Types
// ============================================================================

export type OfferingCategory = 'product' | 'service' | 'share' | 'event';
export type FulfillmentMethod = 'pickup' | 'delivery' | 'online' | 'at_location';
export type PriceType = 'fixed' | 'negotiable' | 'free' | 'donation';

export const OFFERING_CATEGORIES: { value: OfferingCategory; label: string }[] = [
  { value: 'product', label: 'Product' },
  { value: 'service', label: 'Service' },
  { value: 'share', label: 'Share' },
  { value: 'event', label: 'Event' },
];

export const PRICE_TYPES: { value: PriceType; label: string }[] = [
  { value: 'fixed', label: 'Fixed Price' },
  { value: 'negotiable', label: 'Negotiable' },
  { value: 'free', label: 'Free' },
  { value: 'donation', label: 'Donation' },
];

export const FULFILLMENT_METHODS: { value: FulfillmentMethod; label: string }[] = [
  { value: 'pickup', label: 'Pickup' },
  { value: 'delivery', label: 'Delivery' },
  { value: 'online', label: 'Online' },
  { value: 'at_location', label: 'At Location' },
];

export interface OfferingProvider {
  id: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
}

export interface Offering {
  id: string;
  community_id: string;
  provider_id: string;
  created_by_profile_id: string;
  category: OfferingCategory;
  title: string;
  description: string | null;
  price_type: PriceType;
  price_amount: number | null;
  currency_code: string;
  fulfillment_method: FulfillmentMethod;
  pickup_address_id: string | null;
  is_delivery_available: boolean;
  delivery_fee_amount: number | null;
  delivery_radius_km: number | null;
  image_url: string | null;
  is_featured: boolean;
  status: string;
  version: number;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
  // Joined fields
  profiles?: OfferingProvider | null;
  availability_schedules?: AvailabilitySchedule[];
}

export interface AvailabilitySchedule {
  id: string;
  offering_id: string;
  rrule: string;
  dtstart: string;
  dtend: string | null;
  start_time: string;
  end_time: string;
  slots_available: number;
  slot_label: string | null;
  slot_unit: string | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateOfferingInput {
  title: string;
  description?: string;
  category: OfferingCategory;
  price_type?: PriceType;
  price_amount?: number;
  currency_code?: string;
  fulfillment_method?: FulfillmentMethod;
  pickup_address_id?: string | null;
  is_delivery_available?: boolean;
  delivery_fee_amount?: number;
  delivery_radius_km?: number;
}

export interface UpdateOfferingInput {
  title?: string;
  description?: string | null;
  category?: OfferingCategory;
  price_type?: PriceType;
  price_amount?: number;
  fulfillment_method?: FulfillmentMethod;
  status?: 'active' | 'inactive';
}

export interface CreateScheduleInput {
  rrule: string;
  dtstart: string;
  dtend?: string | null;
  start_time: string;
  end_time: string;
  slots_available: number;
  slot_label?: string;
  is_active?: boolean;
}

export interface UpdateScheduleInput {
  rrule?: string;
  dtstart?: string;
  dtend?: string | null;
  start_time?: string;
  end_time?: string;
  slots_available?: number;
  slot_label?: string | null;
  is_active?: boolean;
}

// ============================================================================
// RRule Helpers
// ============================================================================

export type RRuleWeekday = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

export const RRULE_WEEKDAYS: RRuleWeekday[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

export const WEEKDAY_LABELS: Record<RRuleWeekday, string> = {
  MO: 'Mon',
  TU: 'Tue',
  WE: 'Wed',
  TH: 'Thu',
  FR: 'Fri',
  SA: 'Sat',
  SU: 'Sun',
};

export function buildWeeklyRRule(days: RRuleWeekday[]): string {
  return `FREQ=WEEKLY;BYDAY=${days.join(',')}`;
}

export function parseRRuleWeekdays(rrule: string): RRuleWeekday[] {
  const match = rrule.match(/BYDAY=([A-Z,]+)/);
  if (!match) return [];
  return match[1].split(',').filter((d): d is RRuleWeekday =>
    RRULE_WEEKDAYS.includes(d as RRuleWeekday)
  );
}

export function formatRRule(rrule: string): string {
  const days = parseRRuleWeekdays(rrule);
  if (days.length === 7) return 'Every day';
  if (days.length === 5 && ['MO', 'TU', 'WE', 'TH', 'FR'].every((d) => days.includes(d as RRuleWeekday))) {
    return 'Weekdays';
  }
  if (days.length === 2 && days.includes('SA') && days.includes('SU')) return 'Weekends';
  return days.map((d) => WEEKDAY_LABELS[d]).join(', ');
}
