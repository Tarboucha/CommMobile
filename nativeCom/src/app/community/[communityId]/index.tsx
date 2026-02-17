import { useState, useEffect, useCallback } from 'react';
import { View, ActivityIndicator, Alert, Pressable, AppState } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { useTheme } from '@/hooks/use-theme';
import { NAV_COLORS } from '@/lib/constants/nav-colors';
import { getCommunity, getCommunityMembers, joinCommunity, leaveCommunity } from '@/lib/api/communities';
import { ChatTab } from '@/components/pages/community/chat-tab';
import { BoardTab } from '@/components/pages/community/board-tab';
import { InfoTab } from '@/components/pages/community/info-tab';
import { InviteModal } from '@/components/pages/community/invite-modal';
import type { Community, CommunityMember } from '@/types/community';

export default function CommunityDetailScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const user = useAuthStore((s) => s.user);
  const { colorScheme } = useTheme();
  const navColors = NAV_COLORS[colorScheme];

  // Clear cart when screen is removed from the stack (back button)
  // Does NOT fire when pushing child screens (cart, offering detail, etc.)
  useEffect(() => {
    return () => {
      useCartStore.getState().clearCart();
    };
  }, []);

  // Clear cart when app goes to background
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        useCartStore.getState().clearCart();
      }
    });
    return () => sub.remove();
  }, []);

  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [currentMembership, setCurrentMembership] = useState<CommunityMember | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const isOwnerOrAdmin = currentMembership?.member_role === 'owner' || currentMembership?.member_role === 'admin';

  const cartItemCount = useCartStore((s) =>
    s.communityId === communityId
      ? s.items.reduce((count, item) => count + item.quantity, 0)
      : 0
  );

  const loadCommunity = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await getCommunity(communityId!);
      setCommunity(data);

      // Check membership
      if (user) {
        try {
          const membersResult = await getCommunityMembers(communityId!, 100);
          const myMembership = membersResult.data.find((m) => m.profile_id === user.id);
          setIsMember(!!myMembership);
          setCurrentMembership(myMembership ?? null);
        } catch {
          // Fallback to creator check if members fetch fails
          setIsMember(data.created_by_profile_id === user.id);
          setCurrentMembership(null);
        }
      }
    } catch (err) {
      console.error('Failed to load community:', err);
    } finally {
      setIsLoading(false);
    }
  }, [communityId, user]);

  useEffect(() => {
    if (communityId) {
      loadCommunity();
    }
  }, [communityId, loadCommunity]);

  async function handleJoin() {
    if (!communityId) return;
    try {
      setActionLoading(true);
      const member = await joinCommunity(communityId);
      if (member.membership_status === 'pending') {
        Alert.alert('Request Sent', 'Your join request has been submitted.');
      } else {
        Alert.alert('Joined', 'You are now a member of this community.');
      }
      await loadCommunity();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to join community.');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLeave() {
    if (!communityId) return;
    Alert.alert('Leave Community', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            setActionLoading(true);
            // Clear cart when leaving the community
            useCartStore.getState().clearCart();
            await leaveCommunity(communityId);
            router.back();
          } catch (err: any) {
            Alert.alert('Error', err.message || 'Failed to leave community.');
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <View className="flex-1 bg-background justify-center items-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  if (!community) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Not Found' }} />
        <View className="flex-1 bg-background justify-center items-center p-6">
          <Text className="text-lg text-muted-foreground">Community not found.</Text>
        </View>
      </>
    );
  }

  const defaultTab = 'info';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: community.community_name,
          headerStyle: { backgroundColor: navColors.card },
          headerTintColor: navColors.text,
          headerShadowVisible: false,
          headerRight: () =>
            cartItemCount > 0 ? (
              <Pressable
                onPress={() => router.push(`/community/${communityId}/cart`)}
                className="mr-2 relative"
              >
                <Ionicons name="cart-outline" size={24} color={navColors.text} />
                <View className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] rounded-full justify-center items-center px-1 bg-primary">
                  <Text className="text-[11px] font-semibold text-primary-foreground">
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </Text>
                </View>
              </Pressable>
            ) : null,
        }}
      />
      <View className="flex-1 bg-background">
        <Tabs
          value={activeTab ?? defaultTab}
          onValueChange={setActiveTab}
          className="flex-1"
        >
          <View className="px-4 pt-3 pb-1">
            <TabsList className="w-full">
              <TabsTrigger value="info" className="flex-1">
                <Text>Info</Text>
              </TabsTrigger>
              <TabsTrigger value="board" className="flex-1">
                <Text>Board</Text>
              </TabsTrigger>
              <TabsTrigger value="chat" className="flex-1">
                <Text>Chat</Text>
              </TabsTrigger>
            </TabsList>
          </View>

          <TabsContent value="info" className="flex-1">
            <InfoTab
              community={community}
              communityId={communityId!}
              isMember={isMember}
              isOwnerOrAdmin={isOwnerOrAdmin}
              canPostOfferings={!!currentMembership?.can_post_offerings}
              user={user}
              actionLoading={actionLoading}
              onJoin={handleJoin}
              onLeave={handleLeave}
              onInvite={() => setShowInviteModal(true)}
            />
          </TabsContent>

          <TabsContent value="board" className="flex-1">
            <BoardTab
              communityId={communityId!}
              canPostOfferings={!!currentMembership?.can_post_offerings}
              isOwnerOrAdmin={isOwnerOrAdmin}
            />
          </TabsContent>

          <TabsContent value="chat" className="flex-1">
            <ChatTab
              communityId={communityId!}
              isMember={isMember}
              userId={user?.id ?? null}
            />
          </TabsContent>
        </Tabs>
      </View>

      <InviteModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        communityId={communityId!}
      />
    </>
  );
}
