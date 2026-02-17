import { fetchAPI } from '@/lib/api/client';
import type {
  Offering,
  AvailabilitySchedule,
  CreateOfferingInput,
  UpdateOfferingInput,
  CreateScheduleInput,
  UpdateScheduleInput,
} from '@/types/offering';
import type { PaginatedResponse } from '@/types/community';

// ============================================================================
// Offerings
// ============================================================================

export async function getCommunityOfferings(
  communityId: string,
  limit = 20,
  cursor?: string,
  category?: string
): Promise<PaginatedResponse<Offering>> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (cursor) params.set('after', cursor);
  if (category) params.set('category', category);

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
