import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Image,
  ActivityIndicator,
  Alert,
  Pressable,
  AppState,
  ImageBackground,
} from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useCartStore } from '@/lib/stores/cart-store';
import { useCommunityDetail, useCommunityMembers } from '@/hooks/queries/use-communities';
import { useJoinCommunity, useLeaveCommunity } from '@/hooks/queries/use-community-mutations';
import { ChatTab } from '@/components/pages/community/chat-tab';
import { BoardTab } from '@/components/pages/community/board-tab';
import { InfoTab } from '@/components/pages/community/info-tab';
import { InviteModal } from '@/components/pages/community/invite-modal';

type TabKey = 'info' | 'board' | 'chat';

function HeaderLogo() {
  return (
    <Image
      source={require('@/assets/images/icon.png')}
      style={{ width: 120, height: 40 }}
      resizeMode="contain"
    />
  );
}

export default function CommunityDetailScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const user = useAuthStore((s) => s.user);

  // Clear cart when screen is removed from the stack (back button).
  useEffect(() => {
    return () => {
      useCartStore.getState().clearCart();
    };
  }, []);

  // Clear cart when app goes to background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        useCartStore.getState().clearCart();
      }
    });
    return () => sub.remove();
  }, []);

  const { data: community, isLoading: isCommunityLoading } = useCommunityDetail(communityId);
  const { data: membersData } = useCommunityMembers(communityId, 100);

  const joinMutation = useJoinCommunity(communityId!);
  const leaveMutation = useLeaveCommunity(communityId!);

  const [activeTab, setActiveTab] = useState<TabKey>('info');
  const [showInviteModal, setShowInviteModal] = useState(false);

  const currentMembership = useMemo(() => {
    if (!user || !membersData) return null;
    return membersData.data.find((m) => m.profile_id === user.id) ?? null;
  }, [user, membersData]);

  const isMember =
    !!currentMembership ||
    (!!user && !!community && community.created_by_profile_id === user.id);
  const isOwnerOrAdmin =
    currentMembership?.member_role === 'owner' ||
    currentMembership?.member_role === 'admin';
  const isLoading = isCommunityLoading;

  const cartItemCount = useCartStore((s) =>
    s.communityId === communityId
      ? s.items.reduce((count, item) => count + item.quantity, 0)
      : 0,
  );

  function handleJoin() {
    if (!communityId) return;
    joinMutation.mutate(undefined, {
      onSuccess: (member) => {
        if (member.membership_status === 'pending') {
          Alert.alert('Request Sent', 'Your join request has been submitted.');
        } else {
          Alert.alert('Joined', 'You are now a member of this community.');
        }
      },
      onError: (err: any) => {
        Alert.alert('Error', err.message || 'Failed to join community.');
      },
    });
  }

  function handleLeave() {
    if (!communityId) return;
    Alert.alert('Leave Community', 'Are you sure you want to leave?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () => {
          useCartStore.getState().clearCart();
          leaveMutation.mutate(undefined, {
            onSuccess: () => router.back(),
            onError: (err: any) => {
              Alert.alert('Error', err.message || 'Failed to leave community.');
            },
          });
        },
      },
    ]);
  }

  const actionLoading = joinMutation.isPending || leaveMutation.isPending;

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: '' }} />
        <View className="flex-1 bg-background justify-center items-center">
          <ActivityIndicator size="large" color="#660000" />
        </View>
      </>
    );
  }

  if (!community) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Not Found' }} />
        <View className="flex-1 bg-background justify-center items-center p-6">
          <Text className="text-lg" style={{ color: '#78716C' }}>
            Community not found.
          </Text>
        </View>
      </>
    );
  }

  const memberCount = community.current_members_count ?? 0;

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: () => <HeaderLogo />,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#FAF7F2' },
          headerTintColor: '#660000',
          headerShadowVisible: false,
          headerBackTitle: '',
          headerRight: () =>
            cartItemCount > 0 ? (
              <Pressable
                onPress={() => router.push(`/community/${communityId}/cart`)}
                className="mr-2 relative"
                hitSlop={8}
              >
                <Ionicons name="cart-outline" size={24} color="#660000" />
                <View
                  className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] rounded-full justify-center items-center px-1"
                  style={{ backgroundColor: '#660000' }}
                >
                  <Text
                    className="font-semibold"
                    style={{ color: '#FAF7F2', fontSize: 11 }}
                  >
                    {cartItemCount > 99 ? '99+' : cartItemCount}
                  </Text>
                </View>
              </Pressable>
            ) : null,
        }}
      />
      <View className="flex-1" style={{ backgroundColor: '#FAF7F2' }}>
        {/* Hero */}
        <CommunityHero
          name={community.community_name}
          memberCount={memberCount}
          isMember={isMember}
          imageUrl={community.community_image_url}
        />

        {/* Tabs */}
        <CommunityTabs value={activeTab} onChange={setActiveTab} />

        {/* Tab content */}
        <View className="flex-1">
          {activeTab === 'info' && (
            <InfoTab
              community={community}
              communityId={communityId!}
              isMember={isMember}
              isOwnerOrAdmin={isOwnerOrAdmin}
              canPostOfferings={!!currentMembership?.can_post_offerings}
              user={user}
              actionLoading={actionLoading}
              members={membersData?.data ?? []}
              onJoin={handleJoin}
              onLeave={handleLeave}
              onInvite={() => setShowInviteModal(true)}
            />
          )}
          {activeTab === 'board' && (
            <BoardTab
              communityId={communityId!}
              canPostOfferings={!!currentMembership?.can_post_offerings}
              isOwnerOrAdmin={isOwnerOrAdmin}
            />
          )}
          {activeTab === 'chat' && (
            <ChatTab
              communityId={communityId!}
              isMember={isMember}
              userId={user?.id ?? null}
            />
          )}
        </View>
      </View>

      <InviteModal
        visible={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        communityId={communityId!}
      />
    </>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────

function CommunityHero({
  name,
  memberCount,
  isMember,
  imageUrl,
}: {
  name: string;
  memberCount: number;
  isMember: boolean;
  imageUrl: string | null;
}) {
  return (
    <View
      className="flex-row items-center px-6 py-5"
      style={{ gap: 16 }}
    >
      {/* Left: small rounded image (or initial fallback) */}
      <View
        className="rounded-3xl overflow-hidden"
        style={{
          width: 80,
          height: 80,
          backgroundColor: '#F5E6D3',
          shadowColor: '#4a352f',
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          elevation: 2,
        }}
      >
        {imageUrl ? (
          <ImageBackground
            source={{ uri: imageUrl }}
            resizeMode="cover"
            style={{ width: '100%', height: '100%' }}
          />
        ) : (
          <View className="w-full h-full items-center justify-center">
            <Text className="font-bold" style={{ color: '#3E0000', fontSize: 30 }}>
              {(name?.trim()[0] ?? '•').toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Right: name + member count pill + Joined check */}
      <View className="flex-1 min-w-0 gap-2">
        <Text
          className="font-bold"
          style={{
            color: '#3E0000',
            fontSize: 24,
            lineHeight: 30,
            letterSpacing: -0.3,
          }}
          numberOfLines={2}
        >
          {name}
        </Text>
        <View className="flex-row items-center" style={{ gap: 12 }}>
          <View
            className="px-3 py-1 rounded-full"
            style={{ backgroundColor: '#F5E6D3' }}
          >
            <Text
              className="font-semibold"
              style={{ color: '#675D4E', fontSize: 12 }}
            >
              {memberCount} {memberCount === 1 ? 'member' : 'members'}
            </Text>
          </View>
          {isMember && (
            <View className="flex-row items-center" style={{ gap: 4 }}>
              <MaterialCommunityIcons
                name="check-circle"
                size={14}
                color="#891D12"
              />
              <Text
                className="font-semibold"
                style={{ color: '#891D12', fontSize: 12 }}
              >
                Joined
              </Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Tabs ────────────────────────────────────────────────────────────

function CommunityTabs({
  value,
  onChange,
}: {
  value: TabKey;
  onChange: (v: TabKey) => void;
}) {
  const tabs: { key: TabKey; label: string }[] = [
    { key: 'info', label: 'Info' },
    { key: 'board', label: 'Board' },
    { key: 'chat', label: 'Chat' },
  ];

  return (
    <View
      className="flex-row px-6 pt-4"
      style={{ borderBottomWidth: 1, borderBottomColor: '#E8D5D5', backgroundColor: '#FAF7F2' }}
    >
      {tabs.map((t) => {
        const active = value === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            className="pb-3 mr-6"
            style={{
              borderBottomWidth: 2,
              borderBottomColor: active ? '#3E0000' : 'transparent',
            }}
          >
            <Text
              className="font-semibold"
              style={{
                color: active ? '#3E0000' : '#A8A29E',
                fontSize: 16,
              }}
            >
              {t.label}
            </Text>
          </Pressable>
        );
      })}

      {/* Placeholder for icon used by hero overlay (avoids unused-import issue). */}
      <View className="hidden">
        <MaterialCommunityIcons name="account-group" size={1} color="transparent" />
      </View>
    </View>
  );
}
