// ============================================================================
// Booking Component Prop Types
// ============================================================================

export interface AddressSelectorProps {
  selectedAddressId: string | null;
  onSelect: (id: string) => void;
  onAddNew?: () => void;
}

export interface FulfillmentMethodSelectorProps {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  selectedMethod: string | null;
  onSelect: (method: string) => void;
  deliveryFee?: number;
  freeDeliveryThreshold?: number;
  subtotal?: number;
  currencyCode?: string;
}

export interface PaymentMethodSelectorProps {
  fulfillmentMethod: string | null;
  selectedMethod: string | null;
  onSelect: (method: string) => void;
  acceptsOnlinePayment: boolean;
  cashOnDeliveryEnabled: boolean;
  cashOnPickupEnabled: boolean;
}

// ============================================================================
// Booking Status
// ============================================================================

export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'in_progress'
  | 'ready'
  | 'completed'
  | 'cancelled'
  | 'refunded';

// ============================================================================
// Booking API Types
// ============================================================================

export interface BookingItemPayload {
  offering_id: string;
  offering_version: number;
  quantity: number;
  fulfillment_method: string;
  schedule_id: string | null;
  instance_date: string | null;
  special_instructions?: string;
}

export interface BookingCreatePayload {
  community_id: string;
  items: BookingItemPayload[];
  payment_method: 'cash' | 'external';
  delivery_address_id?: string | null;
  special_instructions?: string;
  contact_phone?: string;
  idempotency_key: string;
}

export interface BookingResponse {
  id: string;
  booking_number: string;
  booking_status: BookingStatus;
  provider_id: string;
  community_id: string;
  subtotal_amount: number;
  total_amount: number;
  currency_code: string;
  payment_method: string;
  created_at: string;
}

// ============================================================================
// Booking List Types (for My Bookings screen)
// ============================================================================

export interface BookingListItem {
  id: string;
  booking_number: string;
  booking_status: BookingStatus;
  customer_id: string;
  provider_id: string;
  community_id: string;
  total_amount: number;
  currency_code: string;
  payment_method: string;
  created_at: string;
  confirmed_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  booking_items: {
    id: string;
    snapshot_title: string;
    snapshot_image_url: string | null;
    quantity: number;
  }[];
  booking_community_snapshots: {
    snapshot_community_name: string;
  } | null;
}

// ============================================================================
// Booking Detail Types (for detail screen)
// ============================================================================

export interface BookingItemDetail {
  id: string;
  booking_id: string;
  offering_id: string;
  schedule_id: string | null;
  instance_date: string | null;
  fulfillment_method: string;
  delivery_fee_amount: number;
  quantity: number;
  unit_price_amount: number;
  total_amount: number;
  currency_code: string;
  offering_version: number;
  snapshot_title: string;
  snapshot_description: string | null;
  snapshot_image_url: string | null;
  snapshot_category: string;
  special_instructions: string | null;
  created_at: string;
  // Nested snapshots
  booking_provider_snapshots: ProviderSnapshot | null;
  booking_schedule_snapshots: ScheduleSnapshot | null;
}

export interface ProviderSnapshot {
  id: string;
  original_provider_id: string;
  snapshot_display_name: string;
  snapshot_avatar_url: string | null;
  snapshot_email: string | null;
  snapshot_phone: string | null;
  snapshot_address_id: string | null;
}

export interface ScheduleSnapshot {
  id: string;
  snapshot_dtstart: string;
  snapshot_dtend: string | null;
  snapshot_rrule: string;
  snapshot_start_time: string;
  snapshot_end_time: string;
  snapshot_slots_available: number;
  snapshot_slot_label: string | null;
  had_exception: boolean;
}

export interface CustomerSnapshot {
  id: string;
  original_customer_id: string;
  snapshot_display_name: string | null;
  snapshot_first_name: string | null;
  snapshot_last_name: string | null;
  snapshot_email: string | null;
  snapshot_phone: string | null;
  snapshot_avatar_url: string | null;
}

export interface DeliverySnapshot {
  id: string;
  snapshot_addresses: {
    street_name: string | null;
    street_number: string | null;
    apartment_unit: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
    instructions: string | null;
  } | null;
}

export interface CommunitySnapshot {
  id: string;
  original_community_id: string | null;
  snapshot_community_name: string;
  snapshot_community_description: string | null;
  snapshot_community_image_url: string | null;
}

export interface StatusHistoryEntry {
  id: string;
  from_status: BookingStatus | null;
  to_status: BookingStatus;
  changed_by_id: string | null;
  notes: string | null;
  created_at: string;
}

export interface BookingDetail {
  id: string;
  booking_number: string;
  booking_status: BookingStatus;
  customer_id: string;
  provider_id: string;
  community_id: string;
  currency_code: string;
  subtotal_amount: number;
  service_fee_amount: number;
  total_amount: number;
  payment_method: string;
  payment_status: string;
  delivery_address_id: string | null;
  special_instructions: string | null;
  confirmed_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancelled_by_id: string | null;
  cancellation_reason: string | null;
  created_at: string;
  // Nested data
  booking_items: BookingItemDetail[];
  customer_snapshot: CustomerSnapshot | null;
  delivery_snapshot: DeliverySnapshot | null;
  community_snapshot: CommunitySnapshot | null;
  status_history: StatusHistoryEntry[];
}

// ============================================================================
// Status Update
// ============================================================================

export interface BookingStatusUpdatePayload {
  booking_status: BookingStatus;
  cancellation_reason?: string;
}
