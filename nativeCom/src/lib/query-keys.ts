export const queryKeys = {
  communities: {
    all: ['communities'] as const,
    mine: () => [...queryKeys.communities.all, 'mine'] as const,
    browse: () => [...queryKeys.communities.all, 'browse'] as const,
    detail: (id: string) => [...queryKeys.communities.all, 'detail', id] as const,
    members: (id: string) => [...queryKeys.communities.all, 'members', id] as const,
  },
  bookings: {
    all: ['bookings'] as const,
    list: (role?: string) => [...queryKeys.bookings.all, 'list', role ?? 'all'] as const,
    detail: (id: string) => [...queryKeys.bookings.all, 'detail', id] as const,
  },
  conversations: {
    all: ['conversations'] as const,
    list: (type?: string) => [...queryKeys.conversations.all, 'list', type ?? 'all'] as const,
    messages: (conversationId: string) => [...queryKeys.conversations.all, 'messages', conversationId] as const,
  },
  offerings: {
    all: ['offerings'] as const,
    community: (communityId: string) => [...queryKeys.offerings.all, 'community', communityId] as const,
    detail: (id: string) => [...queryKeys.offerings.all, 'detail', id] as const,
    schedules: (id: string) => [...queryKeys.offerings.all, 'schedules', id] as const,
    timeSlots: (scheduleId: string, date: string) =>
      [...queryKeys.offerings.all, 'timeSlots', scheduleId, date] as const,
  },
  board: {
    all: ['board'] as const,
    feed: (communityId: string) => [...queryKeys.board.all, 'feed', communityId] as const,
  },
  addresses: {
    all: ['addresses'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unreadCount'] as const,
  },
  profile: {
    me: ['profile', 'me'] as const,
  },
};
