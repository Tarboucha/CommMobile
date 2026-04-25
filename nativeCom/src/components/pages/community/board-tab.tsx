import { useCallback, useMemo, useState } from 'react';
import {
  View,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { useCommunityOfferings } from '@/hooks/queries/use-offerings';
import { useCommunityPosts, useBoardFeed } from '@/hooks/queries/use-board';
import { useRefreshOnFocus } from '@/hooks/queries/use-refresh-on-focus';
import { unpinItem, pinItem } from '@/lib/api/board';
import type { Offering } from '@/types/offering';
import type { CommunityPost } from '@/types/post';
import type { PinnedItem } from '@/types/board';

// ============================================================================
// Helpers
// ============================================================================

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatPriceShort(offering: Offering): string {
  if (offering.transaction_type === 'loan') {
    if (offering.price_amount && offering.price_amount > 0) {
      return `${offering.price_amount.toFixed(2)} ${offering.currency_code}`;
    }
    return 'Free loan';
  }
  if (!offering.price_amount || offering.price_amount === 0) return 'FREE';
  return `${offering.price_amount.toFixed(2)} ${offering.currency_code}`;
}

function getProviderName(offering: Offering): string {
  if (offering.profiles) {
    const { first_name, last_name } = offering.profiles;
    if (first_name || last_name) {
      return [first_name, last_name].filter(Boolean).join(' ');
    }
  }
  return 'Unknown';
}

function getAuthorName(post: CommunityPost): string {
  if (post.profiles) {
    const { first_name, last_name } = post.profiles;
    if (first_name || last_name) {
      return [first_name, last_name].filter(Boolean).join(' ');
    }
  }
  return 'Unknown';
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ============================================================================
// Offering filter
// ============================================================================

type OfferingFilter = 'all' | 'sell' | 'loan' | 'services' | 'events';

const FILTER_OPTIONS: { key: OfferingFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'sell', label: 'Sell' },
  { key: 'loan', label: 'Loan' },
  { key: 'services', label: 'Services' },
  { key: 'events', label: 'Events' },
];

function matchesFilter(offering: Offering, filter: OfferingFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'loan') return offering.transaction_type === 'loan';
  if (filter === 'services') return offering.category === 'service';
  if (filter === 'events') return offering.category === 'event';
  // 'sell'
  return offering.category === 'product' && offering.transaction_type !== 'loan';
}

function offeringBadgeText(offering: Offering): string {
  if (offering.transaction_type === 'loan') return 'Loan';
  if (offering.category === 'event') return 'Event';
  if (offering.category === 'service') return 'Service';
  return 'Sell';
}

// ============================================================================
// Avatar (small, with initials fallback)
// ============================================================================

function MiniAvatar({
  url,
  name,
  size = 24,
}: {
  url: string | null | undefined;
  name: string;
  size?: number;
}) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 1,
          borderColor: '#FFFFFF',
        }}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#F5E6D3',
        borderWidth: 1,
        borderColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#660000', fontSize: size * 0.4, fontWeight: '700' }}>
        {getInitials(name)}
      </Text>
    </View>
  );
}

// ============================================================================
// PostCard — editorial white card
// ============================================================================

function PostCard({
  post,
  onPress,
  onLongPress,
}: {
  post: CommunityPost;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const authorName = getAuthorName(post);
  const avatarUrl = post.profiles?.avatar_url;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="rounded-2xl overflow-hidden active:opacity-90"
      style={{
        backgroundColor: '#FFFFFF',
        shadowColor: '#4a352f',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 2,
      }}
    >
      <View className="p-5">
        {/* Author row */}
        <View className="flex-row items-center mb-3">
          <MiniAvatar url={avatarUrl} name={authorName} size={32} />
          <View className="ml-3 flex-1">
            <Text className="font-bold" style={{ color: '#1C1917', fontSize: 13 }}>
              {authorName}
            </Text>
            <Text className="font-sans" style={{ color: '#A8A29E', fontSize: 11 }}>
              {timeAgo(post.created_at)}
            </Text>
          </View>
        </View>

        {/* Title (real DB column, optional) */}
        {post.title && (
          <Text
            className="font-bold mb-2"
            style={{ color: '#3E0000', fontSize: 16, lineHeight: 22 }}
            numberOfLines={2}
          >
            {post.title}
          </Text>
        )}

        {/* Body */}
        <Text
          className="font-sans"
          style={{ color: '#58413E', fontSize: 14, lineHeight: 22 }}
          numberOfLines={post.title ? 3 : 4}
        >
          {post.body}
        </Text>

        {/* Optional image */}
        {post.image_url && (
          <View className="mt-3 rounded-xl overflow-hidden">
            <Image
              source={{ uri: post.image_url }}
              className="w-full"
              style={{ aspectRatio: 16 / 9 }}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Optional link */}
        {post.link_url && (
          <Pressable
            onPress={() => Linking.openURL(post.link_url!)}
            className="mt-3 flex-row items-center gap-2 px-3 py-2 rounded-lg"
            style={{ backgroundColor: '#F5E6D3' }}
          >
            <MaterialCommunityIcons name="link-variant" size={14} color="#660000" />
            <Text
              className="flex-1 font-semibold"
              style={{ color: '#660000', fontSize: 12 }}
              numberOfLines={1}
            >
              {post.link_url}
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ============================================================================
// OfferingGridCard — square image + badge + title + price + author
// ============================================================================

function OfferingGridCard({
  offering,
  onPress,
  onLongPress,
}: {
  offering: Offering;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const providerName = getProviderName(offering);
  const avatarUrl = offering.profiles?.avatar_url;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      className="active:opacity-90"
      style={{ flex: 1 }}
    >
      <View
        className="rounded-3xl overflow-hidden mb-3 aspect-square"
        style={{
          backgroundColor: '#F5E6D3',
          shadowColor: '#4a352f',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.06,
          shadowRadius: 16,
          elevation: 2,
        }}
      >
        {offering.image_url ? (
          <Image
            source={{ uri: offering.image_url }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <MaterialCommunityIcons name="image-outline" size={36} color="#A8A29E" />
          </View>
        )}

        {/* Category badge */}
        <View
          className="absolute top-2.5 right-2.5 px-2.5 py-1 rounded-full"
          style={{ backgroundColor: '#F5DDDA' }}
        >
          <Text
            className="font-bold uppercase"
            style={{ color: '#660000', fontSize: 10, letterSpacing: 0.4 }}
          >
            {offeringBadgeText(offering)}
          </Text>
        </View>
      </View>

      <Text
        className="font-bold leading-snug"
        style={{ color: '#660000', fontSize: 14 }}
        numberOfLines={2}
      >
        {offering.title}
      </Text>

      <Text
        className="font-bold mt-1"
        style={{ color: '#660000', fontSize: 13 }}
      >
        {formatPriceShort(offering)}
      </Text>

      <View className="flex-row items-center gap-1.5 mt-2">
        <MiniAvatar url={avatarUrl} name={providerName} size={20} />
        <Text
          className="font-medium"
          style={{ color: '#A8A29E', fontSize: 11 }}
          numberOfLines={1}
        >
          {providerName}
        </Text>
      </View>
    </Pressable>
  );
}

// ============================================================================
// Filter pills row
// ============================================================================

function OfferingFilters({
  value,
  onChange,
}: {
  value: OfferingFilter;
  onChange: (f: OfferingFilter) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 24, gap: 8 }}
    >
      {FILTER_OPTIONS.map((opt) => {
        const active = opt.key === value;
        return (
          <Pressable
            key={opt.key}
            onPress={() => onChange(opt.key)}
            className="px-5 py-2 rounded-full active:opacity-80"
            style={{ backgroundColor: active ? '#660000' : '#F5E6D3' }}
          >
            <Text
              className="font-bold"
              style={{
                color: active ? '#FAF7F2' : '#675D4E',
                fontSize: 12,
                letterSpacing: 0.3,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ============================================================================
// Section header
// ============================================================================

function SectionHeader({
  label,
  rightLabel,
  onRightPress,
}: {
  label: string;
  rightLabel?: string;
  onRightPress?: () => void;
}) {
  return (
    <View className="flex-row items-center justify-between mb-3">
      <Text
        className="font-bold uppercase"
        style={{ color: '#78716C', fontSize: 11, letterSpacing: 1.5 }}
      >
        {label}
      </Text>
      {rightLabel && onRightPress && (
        <Pressable onPress={onRightPress} hitSlop={8}>
          <Text
            className="font-semibold"
            style={{ color: '#660000', fontSize: 13 }}
          >
            {rightLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ============================================================================
// Pinned banner (existing pinning feature — separate from "Announcements")
// ============================================================================

function PinnedBanner({
  pinned,
  isOwnerOrAdmin,
  onPress,
  onUnpin,
}: {
  pinned: PinnedItem;
  isOwnerOrAdmin: boolean;
  onPress: () => void;
  onUnpin: () => void;
}) {
  return (
    <View className="mb-5">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-1.5">
          <MaterialCommunityIcons name="pin" size={14} color="#d97706" />
          <Text
            className="font-bold uppercase"
            style={{ color: '#d97706', fontSize: 11, letterSpacing: 1 }}
          >
            Pinned
          </Text>
        </View>
        {isOwnerOrAdmin && (
          <Pressable onPress={onUnpin} hitSlop={8}>
            <Text
              className="font-semibold"
              style={{ color: '#A8A29E', fontSize: 12 }}
            >
              Unpin
            </Text>
          </Pressable>
        )}
      </View>

      {pinned.offering ? (
        <PinnedOfferingCard offering={pinned.offering} onPress={onPress} />
      ) : pinned.post ? (
        <PostCard post={pinned.post} onPress={onPress} />
      ) : null}
    </View>
  );
}

function PinnedOfferingCard({
  offering,
  onPress,
}: {
  offering: Offering;
  onPress: () => void;
}) {
  const providerName = getProviderName(offering);
  const avatarUrl = offering.profiles?.avatar_url;

  return (
    <Pressable
      onPress={onPress}
      className="rounded-2xl overflow-hidden active:opacity-90"
      style={{
        backgroundColor: '#FFFFFF',
        shadowColor: '#4a352f',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 2,
      }}
    >
      <View className="p-5">
        <View className="flex-row items-center mb-3">
          <MiniAvatar url={avatarUrl} name={providerName} size={32} />
          <View className="ml-3 flex-1">
            <Text className="font-bold" style={{ color: '#1C1917', fontSize: 13 }}>
              {providerName}
            </Text>
            <Text className="font-sans" style={{ color: '#A8A29E', fontSize: 11 }}>
              {timeAgo(offering.created_at)}
            </Text>
          </View>
        </View>
        <Text
          className="font-bold mb-1"
          style={{ color: '#660000', fontSize: 15, lineHeight: 20 }}
          numberOfLines={2}
        >
          {offering.title}
        </Text>
        {offering.description && (
          <Text
            className="font-sans"
            style={{ color: '#58413E', fontSize: 14, lineHeight: 22 }}
            numberOfLines={2}
          >
            {offering.description}
          </Text>
        )}
        <Text
          className="font-bold mt-2"
          style={{ color: '#660000', fontSize: 14 }}
        >
          {formatPriceShort(offering)}
        </Text>
      </View>
    </Pressable>
  );
}

// ============================================================================
// Loading skeleton
// ============================================================================

function BoardSkeleton() {
  return (
    <View className="px-6 pt-4">
      {[1, 2].map((i) => (
        <View
          key={i}
          className="mb-4 rounded-2xl p-5"
          style={{ backgroundColor: '#FFFFFF' }}
        >
          <View className="flex-row items-center mb-3">
            <Skeleton className="w-8 h-8 rounded-full" />
            <View className="ml-3 flex-1">
              <Skeleton className="w-24 h-3 rounded" />
              <Skeleton className="w-16 h-2.5 rounded mt-1" />
            </View>
          </View>
          <Skeleton className="w-full h-3.5 rounded mb-2" />
          <Skeleton className="w-3/4 h-3 rounded" />
        </View>
      ))}
      <View className="mt-4 flex-row gap-3">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="flex-1 aspect-square rounded-3xl" />
        ))}
      </View>
    </View>
  );
}

// ============================================================================
// BoardTab
// ============================================================================

interface BoardTabProps {
  communityId: string;
  canPostOfferings: boolean;
  isOwnerOrAdmin: boolean;
}

export function BoardTab({ communityId, canPostOfferings, isOwnerOrAdmin }: BoardTabProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<OfferingFilter>('all');

  const postsQuery = useCommunityPosts(communityId);
  const offeringsQuery = useCommunityOfferings(communityId, 100);
  // Legacy board feed only used for the pinned item.
  const boardFeedQuery = useBoardFeed(communityId);

  const posts = postsQuery.data?.data ?? [];
  const pinned = boardFeedQuery.data?.pages[0]?.pinned ?? null;

  const offerings = useMemo(
    () => offeringsQuery.data?.data ?? [],
    [offeringsQuery.data],
  );
  const filteredOfferings = useMemo(
    () => offerings.filter((o) => matchesFilter(o, filter)),
    [offerings, filter],
  );

  const isLoading = postsQuery.isLoading || offeringsQuery.isLoading;
  const isRefreshing =
    (postsQuery.isFetching && !postsQuery.isLoading) ||
    (offeringsQuery.isFetching && !offeringsQuery.isLoading);

  const refetchPosts = postsQuery.refetch;
  const refetchOfferings = offeringsQuery.refetch;
  const refetchBoardFeed = boardFeedQuery.refetch;

  const handleRefresh = useCallback(() => {
    refetchPosts();
    refetchOfferings();
    refetchBoardFeed();
  }, [refetchPosts, refetchOfferings, refetchBoardFeed]);

  useRefreshOnFocus(handleRefresh);

  const handleOfferingPress = useCallback(
    (offering: Offering) => {
      router.push({
        pathname: '/community/[communityId]/offerings/[offeringId]',
        params: { communityId, offeringId: offering.id },
      });
    },
    [router, communityId],
  );

  const handleOfferingLongPress = useCallback(
    (offering: Offering) => {
      if (!isOwnerOrAdmin) return;
      Alert.alert('Offering', undefined, [
        {
          text: 'Pin to top',
          onPress: async () => {
            try {
              await pinItem(communityId, 'offering', offering.id);
              refetchBoardFeed();
            } catch {
              Alert.alert('Error', 'Failed to pin item.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [communityId, isOwnerOrAdmin, refetchBoardFeed],
  );

  const handlePostLongPress = useCallback(
    (post: CommunityPost) => {
      if (!isOwnerOrAdmin) return;
      Alert.alert('Post', undefined, [
        {
          text: 'Pin to top',
          onPress: async () => {
            try {
              await pinItem(communityId, 'post', post.id);
              refetchBoardFeed();
            } catch {
              Alert.alert('Error', 'Failed to pin item.');
            }
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [communityId, isOwnerOrAdmin, refetchBoardFeed],
  );

  const handleUnpin = useCallback(async () => {
    try {
      await unpinItem(communityId);
      refetchBoardFeed();
    } catch {
      Alert.alert('Error', 'Failed to unpin item.');
    }
  }, [communityId, refetchBoardFeed]);

  const handlePinnedPress = useCallback(() => {
    if (pinned?.offering) handleOfferingPress(pinned.offering);
  }, [pinned, handleOfferingPress]);

  const handleFAB = useCallback(() => {
    const canPost = isOwnerOrAdmin;
    const canOffer = canPostOfferings;

    if (canPost && canOffer) {
      Alert.alert('Create', 'What would you like to create?', [
        {
          text: 'New post',
          onPress: () =>
            router.push({
              pathname: '/community/[communityId]/posts/new',
              params: { communityId },
            }),
        },
        {
          text: 'New offering',
          onPress: () =>
            router.push({
              pathname: '/community/[communityId]/offerings/new',
              params: { communityId },
            }),
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else if (canPost) {
      router.push({
        pathname: '/community/[communityId]/posts/new',
        params: { communityId },
      });
    } else if (canOffer) {
      router.push({
        pathname: '/community/[communityId]/offerings/new',
        params: { communityId },
      });
    }
  }, [router, communityId, canPostOfferings, isOwnerOrAdmin]);

  const showFAB = canPostOfferings || isOwnerOrAdmin;

  if (isLoading) {
    return (
      <View className="flex-1" style={{ backgroundColor: '#FAF7F2' }}>
        <BoardSkeleton />
      </View>
    );
  }

  const hasContent = posts.length > 0 || offerings.length > 0 || !!pinned;

  return (
    <View className="flex-1" style={{ backgroundColor: '#FAF7F2' }}>
      <ScrollView
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 96 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#660000"
          />
        }
      >
        {/* Composer prompt */}
        {isOwnerOrAdmin && (
          <View className="px-6 mb-5">
            <Pressable
              className="flex-row items-center gap-3 px-5 py-4 rounded-2xl active:opacity-80"
              style={{ backgroundColor: '#FFFFFF' }}
              onPress={() =>
                router.push({
                  pathname: '/community/[communityId]/posts/new',
                  params: { communityId },
                })
              }
            >
              <View
                className="w-9 h-9 rounded-full items-center justify-center"
                style={{ backgroundColor: '#F5E6D3' }}
              >
                <MaterialCommunityIcons name="pencil-outline" size={18} color="#660000" />
              </View>
              <Text
                className="flex-1 font-sans"
                style={{ color: '#A8A29E', fontSize: 14 }}
              >
                Write something…
              </Text>
              <MaterialCommunityIcons name="image-outline" size={20} color="#A8A29E" />
            </Pressable>
          </View>
        )}

        {/* Pinned */}
        {pinned && (
          <View className="px-6">
            <PinnedBanner
              pinned={pinned}
              isOwnerOrAdmin={isOwnerOrAdmin}
              onPress={handlePinnedPress}
              onUnpin={handleUnpin}
            />
          </View>
        )}

        {/* Posts */}
        {posts.length > 0 && (
          <View className="px-6 mb-7">
            <SectionHeader label="Community posts" />
            <View className="gap-3">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onPress={() => {
                    /* posts have no detail screen yet */
                  }}
                  onLongPress={() => handlePostLongPress(post)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Offerings */}
        {offerings.length > 0 && (
          <View className="mb-7">
            <View className="px-6">
              <SectionHeader label="Offerings" />
            </View>
            <OfferingFilters value={filter} onChange={setFilter} />
            <View
              className="px-6 pt-5 flex-row flex-wrap"
              style={{ rowGap: 24, columnGap: 16 }}
            >
              {filteredOfferings.length === 0 ? (
                <View className="w-full py-10 items-center">
                  <Text className="font-sans" style={{ color: '#A8A29E', fontSize: 14 }}>
                    Nothing in this category yet.
                  </Text>
                </View>
              ) : (
                filteredOfferings.map((offering) => (
                  <View
                    key={offering.id}
                    // 2 columns: each takes ~46% so two of them + the
                    // 16px column gap stay under 100% even on narrow screens.
                    style={{ width: '46%' }}
                  >
                    <OfferingGridCard
                      offering={offering}
                      onPress={() => handleOfferingPress(offering)}
                      onLongPress={
                        isOwnerOrAdmin ? () => handleOfferingLongPress(offering) : undefined
                      }
                    />
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {/* Empty */}
        {!hasContent && (
          <View className="flex-1 justify-center items-center px-8 mt-16 gap-3">
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: '#F5E6D3' }}
            >
              <MaterialCommunityIcons name="newspaper-variant-outline" size={32} color="#660000" />
            </View>
            <Text
              className="font-bold"
              style={{ color: '#1C1917', fontSize: 18 }}
            >
              Nothing here yet
            </Text>
            <Text
              className="font-sans text-center"
              style={{ color: '#78716C', fontSize: 14 }}
            >
              {showFAB
                ? 'Be the first to share something with the community.'
                : 'No posts or offerings have been shared yet.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB — rounded-2xl burgundy square, matches Stitch reference */}
      {showFAB && (
        <Pressable
          onPress={handleFAB}
          className="absolute bottom-6 right-6 w-14 h-14 rounded-2xl items-center justify-center active:scale-95"
          style={{
            backgroundColor: '#660000',
            shadowColor: '#4a352f',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 16,
            elevation: 6,
          }}
        >
          <Ionicons name="add" size={28} color="#FAF7F2" />
        </Pressable>
      )}
    </View>
  );
}
