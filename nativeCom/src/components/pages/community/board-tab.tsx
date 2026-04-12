import { useCallback, useMemo } from 'react';
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
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
  if (!offering.price_amount || offering.price_amount === 0) return 'Free';
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
// Bucket offerings by display category
// ============================================================================

type OfferingBucket = 'products' | 'services' | 'loans' | 'events';

interface BucketConfig {
  key: OfferingBucket;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const BUCKET_ORDER: BucketConfig[] = [
  { key: 'products', label: 'Products', icon: 'cube-outline' },
  { key: 'services', label: 'Services', icon: 'construct-outline' },
  { key: 'loans', label: 'Loans', icon: 'arrow-forward-circle-outline' },
  { key: 'events', label: 'Events', icon: 'calendar-outline' },
];

function getOfferingBucket(offering: Offering): OfferingBucket {
  if (offering.category === 'service') return 'services';
  if (offering.category === 'event') return 'events';
  // category === 'product'
  return offering.transaction_type === 'loan' ? 'loans' : 'products';
}

function bucketOfferings(offerings: Offering[]): Record<OfferingBucket, Offering[]> {
  const buckets: Record<OfferingBucket, Offering[]> = {
    products: [],
    services: [],
    loans: [],
    events: [],
  };
  for (const o of offerings) {
    buckets[getOfferingBucket(o)].push(o);
  }
  return buckets;
}

// ============================================================================
// CompactOfferingCard — used in horizontal rows
// ============================================================================

const CARD_WIDTH = 160;

function CompactOfferingCard({
  offering,
  onPress,
  onLongPress,
}: {
  offering: Offering;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const isLoan = offering.transaction_type === 'loan';
  const isEvent = offering.category === 'event';
  const isService = offering.category === 'service';

  let badgeColor: string;
  let badgeText: string;
  if (isLoan) {
    badgeColor = 'bg-purple-100 text-purple-800';
    badgeText = 'Borrow';
  } else if (isEvent) {
    badgeColor = 'bg-amber-100 text-amber-800';
    badgeText = 'Event';
  } else if (isService) {
    badgeColor = 'bg-green-100 text-green-800';
    badgeText = 'Service';
  } else {
    badgeColor = 'bg-blue-100 text-blue-800';
    badgeText = 'Product';
  }

  const [bgClass, textClass] = badgeColor.split(' ');

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ width: CARD_WIDTH }}
      className="mr-3 rounded-xl border border-neutral-200 bg-white dark:bg-neutral-950 dark:border-neutral-800 overflow-hidden active:opacity-80"
    >
      {/* Image / placeholder */}
      <View className="w-full bg-muted aspect-square items-center justify-center">
        {offering.image_url ? (
          <Image
            source={{ uri: offering.image_url }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <Ionicons
            name={
              isLoan
                ? 'arrow-forward-circle-outline'
                : isEvent
                  ? 'calendar-outline'
                  : isService
                    ? 'construct-outline'
                    : 'cube-outline'
            }
            size={36}
            color="#a8a29e"
          />
        )}
      </View>

      {/* Body */}
      <View className="p-2.5 gap-1">
        <View className={`self-start px-1.5 py-0.5 rounded ${bgClass}`}>
          <Text className={`text-[10px] font-semibold ${textClass}`}>{badgeText}</Text>
        </View>
        <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
          {offering.title}
        </Text>
        <Text className="text-xs font-bold text-primary" numberOfLines={1}>
          {formatPriceShort(offering)}
        </Text>
      </View>
    </Pressable>
  );
}

// ============================================================================
// PostCard
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
      className="mx-4 mb-3 rounded-xl border border-neutral-200 bg-white shadow-sm shadow-black/5 dark:bg-neutral-950 dark:border-neutral-800 overflow-hidden active:opacity-80"
      onPress={onPress}
      onLongPress={onLongPress}
      style={{ elevation: 1 }}
    >
      <View className="p-4">
        {/* Author row */}
        <View className="flex-row items-center mb-3">
          <Avatar className="w-9 h-9">
            {avatarUrl ? (
              <AvatarImage source={{ uri: avatarUrl }} />
            ) : (
              <AvatarFallback>
                <Text className="text-xs font-semibold text-neutral-500">
                  {getInitials(authorName)}
                </Text>
              </AvatarFallback>
            )}
          </Avatar>
          <View className="ml-2.5 flex-1">
            <Text className="text-sm font-semibold text-foreground">{authorName}</Text>
            <Text className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</Text>
          </View>
          <Badge variant="secondary">
            <Text className="text-xs font-medium">Post</Text>
          </Badge>
        </View>

        {/* Body */}
        <Text className="text-sm text-foreground leading-5" numberOfLines={4}>
          {post.body}
        </Text>

        {/* Optional image */}
        {post.image_url && (
          <View className="mt-3 rounded-lg overflow-hidden">
            <Image
              source={{ uri: post.image_url }}
              className="w-full rounded-lg"
              style={{ aspectRatio: 16 / 9 }}
              resizeMode="cover"
            />
          </View>
        )}

        {/* Optional link */}
        {post.link_url && (
          <Pressable
            className="mt-3 flex-row items-center gap-2 px-3 py-2.5 bg-neutral-50 rounded-lg dark:bg-neutral-900"
            onPress={() => Linking.openURL(post.link_url!)}
          >
            <Ionicons name="link-outline" size={16} color="#78716C" />
            <Text className="text-xs text-primary flex-1" numberOfLines={1}>
              {post.link_url}
            </Text>
            <Ionicons name="open-outline" size={14} color="#78716C" />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

// ============================================================================
// Category row
// ============================================================================

function CategoryRow({
  config,
  offerings,
  onItemPress,
  onItemLongPress,
}: {
  config: BucketConfig;
  offerings: Offering[];
  onItemPress: (offering: Offering) => void;
  onItemLongPress?: (offering: Offering) => void;
}) {
  if (offerings.length === 0) return null;

  return (
    <View className="mb-5">
      <View className="flex-row items-center gap-2 px-4 mb-2">
        <Ionicons name={config.icon} size={16} color="#660000" />
        <Text className="text-base font-bold text-foreground">{config.label}</Text>
        <Text className="text-xs text-muted-foreground">({offerings.length})</Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16 }}
      >
        {offerings.map((offering) => (
          <CompactOfferingCard
            key={offering.id}
            offering={offering}
            onPress={() => onItemPress(offering)}
            onLongPress={onItemLongPress ? () => onItemLongPress(offering) : undefined}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// Pinned banner
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
    <View className="mx-4 mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="pin" size={14} color="#d97706" />
          <Text className="text-xs font-semibold text-amber-600">Pinned</Text>
        </View>
        {isOwnerOrAdmin && (
          <Pressable className="px-2.5 py-1 rounded-md active:bg-muted" onPress={onUnpin}>
            <Text className="text-xs text-muted-foreground">Unpin</Text>
          </Pressable>
        )}
      </View>

      <View className="border-l-[3px] border-amber-500 rounded-r-xl">
        {pinned.offering ? (
          <PostLikeOfferingPreview offering={pinned.offering} onPress={onPress} />
        ) : pinned.post ? (
          <PostCard post={pinned.post} onPress={onPress} />
        ) : null}
      </View>
    </View>
  );
}

/** Wider offering preview used only for the pinned banner — looks like a post card */
function PostLikeOfferingPreview({
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
      className="mx-0 rounded-xl border border-neutral-200 bg-white dark:bg-neutral-950 dark:border-neutral-800 overflow-hidden active:opacity-80"
      onPress={onPress}
    >
      <View className="p-4">
        <View className="flex-row items-center mb-3">
          <Avatar className="w-9 h-9">
            {avatarUrl ? (
              <AvatarImage source={{ uri: avatarUrl }} />
            ) : (
              <AvatarFallback>
                <Text className="text-xs font-semibold text-neutral-500">
                  {getInitials(providerName)}
                </Text>
              </AvatarFallback>
            )}
          </Avatar>
          <View className="ml-2.5 flex-1">
            <Text className="text-sm font-semibold text-foreground">{providerName}</Text>
            <Text className="text-xs text-muted-foreground">{timeAgo(offering.created_at)}</Text>
          </View>
        </View>
        <Text className="text-base font-semibold text-foreground mb-1" numberOfLines={2}>
          {offering.title}
        </Text>
        {offering.description && (
          <Text className="text-sm text-muted-foreground" numberOfLines={2}>
            {offering.description}
          </Text>
        )}
        <Text className="text-sm font-bold text-primary mt-2">{formatPriceShort(offering)}</Text>
      </View>
    </Pressable>
  );
}

// ============================================================================
// Loading skeleton
// ============================================================================

function BoardSkeleton() {
  return (
    <View className="px-4 pt-3">
      {[1, 2].map((i) => (
        <View
          key={i}
          className="mb-3 rounded-xl border border-neutral-200 bg-white p-4 dark:bg-neutral-950 dark:border-neutral-800"
        >
          <View className="flex-row items-center mb-3">
            <Skeleton className="w-9 h-9 rounded-full" />
            <View className="ml-2.5 flex-1">
              <Skeleton className="w-24 h-3.5 rounded" />
              <Skeleton className="w-16 h-3 rounded mt-1" />
            </View>
          </View>
          <Skeleton className="w-full h-4 rounded mb-2" />
          <Skeleton className="w-3/4 h-3.5 rounded" />
        </View>
      ))}
      <View className="mt-4">
        <Skeleton className="w-32 h-4 rounded mb-2" />
        <View className="flex-row gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="w-40 h-48 rounded-xl" />
          ))}
        </View>
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

  // Fetch posts and offerings independently
  const postsQuery = useCommunityPosts(communityId);
  const offeringsQuery = useCommunityOfferings(communityId, 100);
  // Use the legacy board feed only for the pinned item
  const boardFeedQuery = useBoardFeed(communityId);

  const posts = postsQuery.data?.data ?? [];
  const pinned = boardFeedQuery.data?.pages[0]?.pinned ?? null;

  // Memoize to keep a stable reference for the bucketing useMemo below.
  const offerings = useMemo(
    () => offeringsQuery.data?.data ?? [],
    [offeringsQuery.data]
  );
  const buckets = useMemo(() => bucketOfferings(offerings), [offerings]);

  const isLoading = postsQuery.isLoading || offeringsQuery.isLoading;
  const isRefreshing =
    (postsQuery.isFetching && !postsQuery.isLoading) ||
    (offeringsQuery.isFetching && !offeringsQuery.isLoading);

  // Keep stable references to the refetch functions so useRefreshOnFocus
  // doesn't trigger an infinite re-fetch loop. The query objects themselves
  // are new refs every render, but query.refetch is stable.
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
    [router, communityId]
  );

  const handleOfferingLongPress = useCallback(
    (offering: Offering) => {
      if (!isOwnerOrAdmin) return;
      Alert.alert('Offering', undefined, [
        {
          text: 'Pin to Top',
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
    [communityId, isOwnerOrAdmin, refetchBoardFeed]
  );

  const handlePostLongPress = useCallback(
    (post: CommunityPost) => {
      if (!isOwnerOrAdmin) return;
      Alert.alert('Post', undefined, [
        {
          text: 'Pin to Top',
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
    [communityId, isOwnerOrAdmin, refetchBoardFeed]
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
          text: 'New Post',
          onPress: () =>
            router.push({
              pathname: '/community/[communityId]/posts/new',
              params: { communityId },
            }),
        },
        {
          text: 'New Offering',
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
      <View className="flex-1 bg-background">
        <BoardSkeleton />
      </View>
    );
  }

  const hasContent = posts.length > 0 || offerings.length > 0 || !!pinned;

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Composer prompt */}
        {isOwnerOrAdmin && (
          <Pressable
            className="mx-4 mb-3 flex-row items-center gap-3 p-4 rounded-xl border border-neutral-200 bg-white dark:bg-neutral-950 dark:border-neutral-800 active:bg-neutral-50 dark:active:bg-neutral-900"
            onPress={() =>
              router.push({
                pathname: '/community/[communityId]/posts/new',
                params: { communityId },
              })
            }
          >
            <View className="w-9 h-9 rounded-full bg-neutral-100 dark:bg-neutral-800 justify-center items-center">
              <Ionicons name="create-outline" size={18} color="#78716C" />
            </View>
            <Text className="flex-1 text-sm text-muted-foreground">Write something...</Text>
            <Ionicons name="image-outline" size={20} color="#a1a1aa" />
          </Pressable>
        )}

        {/* Pinned item */}
        {pinned && (
          <PinnedBanner
            pinned={pinned}
            isOwnerOrAdmin={isOwnerOrAdmin}
            onPress={handlePinnedPress}
            onUnpin={handleUnpin}
          />
        )}

        {/* Posts feed (vertical) */}
        {posts.length > 0 && (
          <View className="mb-2">
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
        )}

        {/* Category rows (horizontal) */}
        {BUCKET_ORDER.map((config) => (
          <CategoryRow
            key={config.key}
            config={config}
            offerings={buckets[config.key]}
            onItemPress={handleOfferingPress}
            onItemLongPress={handleOfferingLongPress}
          />
        ))}

        {/* Empty state */}
        {!hasContent && (
          <View className="flex-1 justify-center items-center p-6 gap-4 mt-12">
            <View className="w-16 h-16 rounded-full bg-muted justify-center items-center">
              <Ionicons name="newspaper-outline" size={32} color="#78716C" />
            </View>
            <Text className="text-lg font-semibold text-foreground">Nothing here yet</Text>
            <Text className="text-sm text-muted-foreground text-center max-w-[280px]">
              {showFAB
                ? 'Be the first to post something to the community board.'
                : 'No posts or offerings have been shared yet.'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      {showFAB && (
        <Pressable
          className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary justify-center items-center shadow-lg active:opacity-80"
          onPress={handleFAB}
          style={{ elevation: 6 }}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </Pressable>
      )}
    </View>
  );
}
