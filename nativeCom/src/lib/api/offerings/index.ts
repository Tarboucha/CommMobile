import { fetchAPI } from '@/lib/api/client';
import type {
  Offering,
  AvailabilitySchedule,
  CreateOfferingInput,
  UpdateOfferingInput,
  CreateScheduleInput,
  UpdateScheduleInput,
  TimeSlotResponse,
} from '@/types/offering';
import type { PaginatedResponse } from '@/types/community';

// ============================================================================
// Offerings
// ============================================================================

export interface OfferingsFilter {
  category?: string;
  transactionType?: string;
}

export async function getCommunityOfferings(
  communityId: string,
  limit = 20,
  cursor?: string,
  filter?: OfferingsFilter | string
): Promise<PaginatedResponse<Offering>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('after', cursor);

  // Backward compat: allow passing category as a string (legacy signature)
  if (typeof filter === 'string') {
    params.set('category', filter);
  } else if (filter) {
    if (filter.category) params.set('category', filter.category);
    if (filter.transactionType) params.set('transaction_type', filter.transactionType);
  }

  const response = await fetchAPI<{
    success: boolean;
    data: PaginatedResponse<Offering>;
  }>(`/api/communities/${communityId}/offerings?${params}`, { method: 'GET' });

  return response.data;
}

export async function getOffering(offeringId: string): Promise<Offering> {
  const response = await fetchAPI<{
    success: boolean;
    data: { offering: Offering };
  }>(`/api/offerings/${offeringId}`, { method: 'GET' });

  return response.data.offering;
}

export async function createOffering(
  communityId: string,
  data: CreateOfferingInput
): Promise<Offering> {
  const response = await fetchAPI<{
    success: boolean;
    data: { offering: Offering };
  }>(`/api/communities/${communityId}/offerings`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.data.offering;
}

export async function updateOffering(
  offeringId: string,
  data: UpdateOfferingInput
): Promise<Offering> {
  const response = await fetchAPI<{
    success: boolean;
    data: { offering: Offering };
  }>(`/api/offerings/${offeringId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  return response.data.offering;
}

export async function deleteOffering(offeringId: string): Promise<void> {
  await fetchAPI<{ success: boolean }>(
    `/api/offerings/${offeringId}`,
    { method: 'DELETE' }
  );
}

// ============================================================================
// Schedules
// ============================================================================

export async function getOfferingSchedules(
  offeringId: string
): Promise<AvailabilitySchedule[]> {
  const response = await fetchAPI<{
    success: boolean;
    data: { schedules: AvailabilitySchedule[] };
  }>(`/api/offerings/${offeringId}/schedules`, { method: 'GET' });

  return response.data.schedules;
}

export async function createOfferingSchedule(
  offeringId: string,
  data: CreateScheduleInput
): Promise<AvailabilitySchedule> {
  const response = await fetchAPI<{
    success: boolean;
    data: { schedule: AvailabilitySchedule };
  }>(`/api/offerings/${offeringId}/schedules`, {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.data.schedule;
}

export async function updateOfferingSchedule(
  offeringId: string,
  scheduleId: string,
  data: UpdateScheduleInput
): Promise<AvailabilitySchedule> {
  const response = await fetchAPI<{
    success: boolean;
    data: { schedule: AvailabilitySchedule };
  }>(`/api/offerings/${offeringId}/schedules/${scheduleId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });

  return response.data.schedule;
}

export async function deleteOfferingSchedule(
  offeringId: string,
  scheduleId: string
): Promise<void> {
  await fetchAPI<{ success: boolean }>(
    `/api/offerings/${offeringId}/schedules/${scheduleId}`,
    { method: 'DELETE' }
  );
}

/**
 * Fetch computed time slots for a time-slotted schedule on a specific date.
 * Returns empty slots array if the schedule is date-based (no slot_duration_minutes).
 */
export async function getTimeSlots(
  offeringId: string,
  scheduleId: string,
  date: string
): Promise<TimeSlotResponse> {
  const response = await fetchAPI<{
    success: boolean;
    data: TimeSlotResponse;
  }>(`/api/offerings/${offeringId}/schedules/${scheduleId}/time-slots?date=${date}`, {
    method: 'GET',
  });

  return response.data;
}
