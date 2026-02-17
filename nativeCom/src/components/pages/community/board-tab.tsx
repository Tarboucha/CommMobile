import { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  Pressable,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Tag } from '@/components/ui/tag';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { getBoardFeed, pinItem, unpinItem } from '@/lib/api/board';
import { useCartStore } from '@/lib/stores/cart-store';
import type { BoardItem, BoardFeedResponse, PinnedItem } from '@/types/board';
import type { Offering } from '@/types/offering';
import type { CommunityPost } from '@/types/post';

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

function formatPrice(offering: Offering): string {
  if (offering.price_type === 'free') return 'Free';
  if (offering.price_type === 'donation') return 'Donation';
  if (offering.price_amount) {
    const prefix = offering.price_type === 'negotiable' ? '~' : '';
    return `${prefix}${offering.price_amount.toFixed(2)} ${offering.currency_code}`;
  }
  return '';
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

const CATEGORY_TAG_VARIANT: Record<string, 'primary' | 'success' | 'featured' | 'secondary'> = {
  product: 'primary',
  service: 'success',
  share: 'secondary',
  event: 'featured',
};

// ============================================================================
// OfferingCard
// ============================================================================

function OfferingCard({
  offering,
  onPress,
  onLongPress,
}: {
  offering: Offering;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const addItem = useCartStore((s) => s.addItem);
  const providerName = getProviderName(offering);
  const avatarUrl = offering.profiles?.avatar_url;
  const tagVariant = CATEGORY_TAG_VARIANT[offering.category] ?? 'secondary';

  function handleAddToCart() {
    addItem({
      offeringId: offering.id,
      offeringTitle: offering.title,
      offeringCategory: offering.category,
      priceAmount: offering.price_amount ?? 0,
      currencyCode: offering.currency_code,
      providerId: offering.provider_id,
      providerName,
      communityId: offering.community_id,
      imageUrl: offering.image_url,
      offeringVersion: offering.version,
      scheduleId: null,
      instanceDate: null,
      fulfillmentMethod: offering.fulfillment_method,
      deliveryFeeAmount: offering.delivery_fee_amount ?? null,
    });
  }

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
                  {getInitials(providerName)}
                </Text>
              </AvatarFallback>
            )}
          </Avatar>
          <View className="ml-2.5 flex-1">
            <Text className="text-sm font-semibold text-foreground">{providerName}</Text>
            <Text className="text-xs text-muted-foreground">{timeAgo(offering.created_at)}</Text>
          </View>
          <Tag variant={tagVariant} size="sm">
            {offering.category.charAt(0).toUpperCase() + offering.category.slice(1)}
          </Tag>
        </View>

        {/* Title */}
        <Text className="text-base font-semibold text-foreground mb-1" numberOfLines={2}>
          {offering.title}
        </Text>

        {/* Description */}
        {offering.description && (
          <Text className="text-sm text-muted-foreground mb-3" numberOfLines={2}>
            {offering.description}
          </Text>
        )}

        {/* Price row */}
        <View className="flex-row items-center justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
          <Text className="text-sm font-bold text-primary">
            {formatPrice(offering)}
          </Text>
          <View className="flex-row items-center gap-3">
            <View className="flex-row items-center gap-1">
              <Ionicons name="pricetag-outline" size={12} color="#78716C" />
              <Text className="text-xs text-muted-foreground capitalize">
                {offering.fulfillment_method?.replace('_', ' ') ?? ''}
              </Text>
            </View>
            <Pressable
              onPress={(e) => {
                e.stopPropagation();
                handleAddToCart();
              }}
              className="w-8 h-8 rounded-full bg-primary items-center justify-center active:opacity-80"
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
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
// PinnedItemCard
// ============================================================================

function PinnedItemCard({
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
      {/* Pin header */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-1.5">
          <Ionicons name="pin" size={14} color="#d97706" />
          <Text className="text-xs font-semibold text-amber-600">Pinned</Text>
        </View>
        {isOwnerOrAdmin && (
          <Pressable
            className="px-2.5 py-1 rounded-md active:bg-muted"
            onPress={onUnpin}
          >
            <Text className="text-xs text-muted-foreground">Unpin</Text>
          </Pressable>
        )}
      </View>

      {/* Card with accent border */}
      <View className="border-l-[3px] border-amber-500 rounded-r-xl">
        {pinned.offering ? (
          <OfferingCard offering={pinned.offering} onPress={onPress} />
        ) : pinned.post ? (
          <PostCard post={pinned.post} onPress={onPress} />
        ) : null}
      </View>
    </View>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function BoardSkeleton() {
  return (
    <View className="px-4 pt-3">
      {[1, 2, 3].map((i) => (
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
            <Skeleton className="w-16 h-5 rounded" />
          </View>
          <Skeleton className="w-full h-4 rounded mb-2" />
          <Skeleton className="w-3/4 h-3.5 rounded mb-3" />
          <View className="flex-row justify-between pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <Skeleton className="w-20 h-4 rounded" />
            <Skeleton className="w-16 h-3 rounded" />
          </View>
        </View>
      ))}
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
  const [feedData, setFeedData] = useState<BoardItem[]>([]);
  const [pinned, setPinned] = useState<PinnedItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  const loadBoard = useCallback(
    async (cursor?: string) => {
      try {
        const result: BoardFeedResponse = await getBoardFeed(communityId, 20, cursor);

        if (cursor) {
          setFeedData((prev) => [...prev, ...result.data]);
        } else {
          setFeedData(result.data);
          setPinned(result.pinned);
        }
        setNextCursor(result.pagination.next_cursor);
      } catch (err) {
        console.error('Failed to load board:', err);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [communityId]
  );

  useFocusEffect(
    useCallback(() => {
      loadBoard();
    }, [loadBoard])
  );

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadBoard();
  };

  const handleLoadMore = () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    loadBoard(nextCursor);
  };

  const handleOfferingPress = (offering: Offering) => {
    router.push({
      pathname: '/community/[communityId]/offerings/[offeringId]',
      params: { communityId, offeringId: offering.id },
    });
  };

  const handlePostPress = (_post: CommunityPost) => {
    // Posts don't have a detail screen yet
  };

  const handleItemPress = (item: BoardItem) => {
    if (item.type === 'offering') {
      handleOfferingPress(item.item as Offering);
    } else {
      handlePostPress(item.item as CommunityPost);
    }
  };

  const handleLongPress = (item: BoardItem) => {
    if (!isOwnerOrAdmin) return;

    const itemId = item.item.id;
    const itemType = item.type;

    Alert.alert('Board Item', undefined, [
      {
        text: 'Pin to Top',
        onPress: async () => {
          try {
            await pinItem(communityId, itemType, itemId);
            loadBoard();
          } catch (err) {
            console.error('Failed to pin:', err);
            Alert.alert('Error', 'Failed to pin item.');
          }
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const handleUnpin = async () => {
    try {
      await unpinItem(communityId);
      setPinned(null);
      loadBoard();
    } catch (err) {
      console.error('Failed to unpin:', err);
      Alert.alert('Error', 'Failed to unpin item.');
    }
  };

  const handlePinnedPress = () => {
    if (pinned?.offering) {
      handleOfferingPress(pinned.offering);
    } else if (pinned?.post) {
      handlePostPress(pinned.post);
    }
  };

  const handleFAB = () => {
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
  };

  const showFAB = canPostOfferings || isOwnerOrAdmin;

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <BoardSkeleton />
      </View>
    );
  }

  const renderItem = ({ item }: { item: BoardItem }) => {
    if (item.type === 'offering') {
      return (
        <OfferingCard
          offering={item.item as Offering}
          onPress={() => handleItemPress(item)}
          onLongPress={() => handleLongPress(item)}
        />
      );
    }
    return (
      <PostCard
        post={item.item as CommunityPost}
        onPress={() => handleItemPress(item)}
        onLongPress={() => handleLongPress(item)}
      />
    );
  };

  return (
    <View className="flex-1 bg-background">
      <FlatList
        data={feedData}
        keyExtractor={(item) => `${item.type}-${item.item.id}`}
        renderItem={renderItem}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <>
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
                <Text className="flex-1 text-sm text-muted-foreground">
                  Write something...
                </Text>
                <Ionicons name="image-outline" size={20} color="#a1a1aa" />
              </Pressable>
            )}

            {/* Pinned item */}
            {pinned ? (
              <PinnedItemCard
                pinned={pinned}
                isOwnerOrAdmin={isOwnerOrAdmin}
                onPress={handlePinnedPress}
                onUnpin={handleUnpin}
              />
            ) : null}
          </>
        }
        ListFooterComponent={
          isLoadingMore ? (
            <View className="py-4 items-center">
              <Skeleton className="w-8 h-8 rounded-full" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-6 gap-4">
            <View className="w-16 h-16 rounded-full bg-muted justify-center items-center">
              <Ionicons name="newspaper-outline" size={32} color="#78716C" />
            </View>
            <Text className="text-lg font-semibold text-foreground">
              Nothing here yet
            </Text>
            <Text className="text-sm text-muted-foreground text-center max-w-[280px]">
              {showFAB
                ? 'Be the first to post something to the community board.'
                : 'No posts or offerings have been shared yet.'}
            </Text>
          </View>
        }
      />

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
