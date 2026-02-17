import type { NotificationType, NotificationTypeConfig } from '@/types/notification';

/**
 * Notification type color and badge configuration
 */
export const NOTIFICATION_TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
  // Booking
  booking_new: {
    color: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    badgeText: 'BN',
    label: 'New Booking',
  },
  booking_confirmed: {
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    badgeText: 'BC',
    label: 'Booking Confirmed',
  },
  booking_status_update: {
    color: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    badgeText: 'BS',
    label: 'Booking Status',
  },
  booking_completed: {
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    badgeText: 'BD',
    label: 'Booking Completed',
  },
  booking_cancelled: {
    color: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    badgeText: 'BX',
    label: 'Booking Cancelled',
  },
  // Payment
  payment_received: {
    color: '#84CC16',
    backgroundColor: 'rgba(132, 204, 22, 0.2)',
    badgeText: 'PR',
    label: 'Payment Received',
  },
  payment_refunded: {
    color: '#F97316',
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    badgeText: 'PF',
    label: 'Payment Refunded',
  },
  // Community
  community_invite: {
    color: '#A855F7',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    badgeText: 'CI',
    label: 'Community Invite',
  },
  community_join_request: {
    color: '#A855F7',
    backgroundColor: 'rgba(168, 85, 247, 0.2)',
    badgeText: 'CJ',
    label: 'Join Request',
  },
  community_member_approved: {
    color: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    badgeText: 'CA',
    label: 'Member Approved',
  },
  // Offering
  new_offering: {
    color: '#F97316',
    backgroundColor: 'rgba(249, 115, 22, 0.2)',
    badgeText: 'NO',
    label: 'New Offering',
  },
  offering_update: {
    color: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    badgeText: 'OU',
    label: 'Offering Update',
  },
  // Review
  new_review: {
    color: '#FACC15',
    backgroundColor: 'rgba(250, 204, 21, 0.2)',
    badgeText: 'NR',
    label: 'New Review',
  },
  // Message
  new_message: {
    color: '#3B82F6',
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    badgeText: 'NM',
    label: 'New Message',
  },
  // System
  system: {
    color: '#64748B',
    backgroundColor: 'rgba(100, 116, 139, 0.2)',
    badgeText: 'SY',
    label: 'System',
  },
};

export function getNotificationTypeConfig(type: string): NotificationTypeConfig {
  return NOTIFICATION_TYPE_CONFIG[type as NotificationType] || NOTIFICATION_TYPE_CONFIG.system;
}
