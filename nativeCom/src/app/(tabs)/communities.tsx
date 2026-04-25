import { useState } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Image,
  ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useMyCommunities, useBrowseCommunities } from '@/hooks/queries/use-communities';
import { useRefreshOnFocus } from '@/hooks/queries/use-refresh-on-focus';
import type { Community } from '@/types/community';

// ─── Shared sub-components ──────────────────────────────────────────

function AccessBadge({ type }: { type: string | null }) {
  const label =
    type === 'open'
      ? 'Open'
      : type === 'request_to_join'
        ? 'Request'
        : 'Invite only';

  return (
    <View
      className="px-2.5 py-0.5 rounded-full"
      style={{ backgroundColor: '#F5E6D3' }}
    >
      <Text
        className="font-semibold"
        style={{ color: '#660000', fontSize: 11, letterSpacing: 0.3 }}
      >
        {label}
      </Text>
    </View>
  );
}

function CommunityInitial({ name }: { name: string }) {
  // Placeholder avatar — first letter of community name on a soft beige tile.
  const letter = (name?.trim()[0] ?? '•').toUpperCase();
  return (
    <View
      className="w-16 h-16 rounded-2xl items-center justify-center"
      style={{ backgroundColor: '#F5E6D3' }}
    >
      <Text
        className="font-bold"
        style={{ color: '#660000', fontSize: 24 }}
      >
        {letter}
      </Text>
    </View>
  );
}

function CommunityCard({ community, browse }: { community: Community; browse?: boolean }) {
  const avatarUrl = (community as any).avatar_url as string | null | undefined;

  return (
    <Pressable
      onPress={() => router.push(`/community/${community.id}` as Href)}
      className="flex-row items-center gap-4 px-5 py-7 rounded-2xl mb-7 active:opacity-90"
      style={{
        backgroundColor: '#FFFFFF',
        shadowColor: '#4a352f',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 2,
      }}
    >
      {avatarUrl ? (
        <Image
          source={{ uri: avatarUrl }}
          className="w-18 h-18 rounded-2xl"
          resizeMode="cover"
        />
      ) : (
        <CommunityInitial name={community.community_name} />
      )}

      <View className="flex-1 min-w-0 gap-1">
        <View className="flex-row items-center gap-2">
          <Text
            className="flex-1 font-semibold"
            style={{ color: '#1C1917', fontSize: 17, lineHeight: 22 }}
            numberOfLines={1}
          >
            {community.community_name}
          </Text>
          {browse && <AccessBadge type={community.access_type} />}
        </View>

        <View className="flex-row items-center gap-2">
          <MaterialCommunityIcons name="account-group-outline" size={14} color="#78716C" />
          <Text
            className="font-sans"
            style={{ color: '#78716C', fontSize: 13 }}
          >
            {browse
              ? `${community.current_members_count ?? 0} / ${community.max_members ?? '∞'} members`
              : `${community.current_members_count ?? 0} members`}
          </Text>
        </View>
      </View>

      <MaterialCommunityIcons name="chevron-right" size={22} color="#A8A29E" />
    </Pressable>
  );
}

function CreateCommunityCard() {
  return (
    <View
      className="rounded-3xl mt-6 px-6 py-8 items-center"
      style={{
        backgroundColor: '#660000',
        shadowColor: '#4a352f',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.18,
        shadowRadius: 20,
        elevation: 4,
      }}
    >
      <Text
        className="font-semibold text-center mb-2"
        style={{ color: '#FAF7F2', fontSize: 22, lineHeight: 28 }}
      >
        Build your own group?
      </Text>
      <Text
        className="font-sans text-center mb-6"
        style={{ color: 'rgba(250, 247, 242, 0.85)', fontSize: 14, lineHeight: 20 }}
      >
        Start a community for your block or building in minutes.
      </Text>
      <Pressable
        onPress={() => router.push('/community/create' as Href)}
        className="rounded-2xl self-stretch py-4 items-center active:opacity-90"
        style={{ backgroundColor: '#FAF7F2' }}
      >
        <Text
          className="font-bold"
          style={{ color: '#660000', fontSize: 15 }}
        >
          Create Community
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Segmented tab selector ──────────────────────────────────────────

function SegmentedTabs({
  value,
  onChange,
}: {
  value: 'my' | 'browse';
  onChange: (v: 'my' | 'browse') => void;
}) {
  return (
    <View
      className="flex-row p-1 rounded-full"
      style={{ backgroundColor: '#F5E6D3' }}
    >
      {(['my', 'browse'] as const).map((key) => {
        const active = value === key;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(key)}
            className="flex-1 py-2.5 items-center rounded-full"
            style={{ backgroundColor: active ? '#660000' : 'transparent' }}
          >
            <Text
              className="font-semibold"
              style={{
                color: active ? '#FAF7F2' : '#78716C',
                fontSize: 13,
                letterSpacing: 0.3,
              }}
            >
              {key === 'my' ? 'My Communities' : 'Explore'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── My Communities list ─────────────────────────────────────────────

function MyCommunities() {
  const { data, isLoading, isFetching, refetch } = useMyCommunities();
  useRefreshOnFocus(refetch);

  const communities = data?.data ?? [];

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#660000" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ paddingHorizontal: 30, paddingTop: 16, paddingBottom: 32 }}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={() => refetch()}
          tintColor="#660000"
        />
      }
    >
      {communities.length > 0 && (
        <View className="flex-row items-center justify-between mb-5 px-1">
          <Text
            className="font-bold"
            style={{ color: '#1C1917', fontSize: 26, lineHeight: 32 }}
          >
            {`Member of ${communities.length}`}
          </Text>
          <Pressable
            onPress={() => router.push('/account/profile' as Href)}
            hitSlop={8}
            className="flex-row items-center gap-1 active:opacity-70"
          >
            <Text
              className="font-semibold"
              style={{ color: '#660000', fontSize: 13 }}
            >
              Manage
            </Text>
            <MaterialCommunityIcons name="cog-outline" size={14} color="#660000" />
          </Pressable>
        </View>
      )}

      {communities.length === 0 ? (
        <View className="items-center py-10 px-6">
          <MaterialCommunityIcons name="account-group-outline" size={48} color="#78716C" />
          <Text
            className="font-semibold mt-4 mb-2"
            style={{ color: '#1C1917', fontSize: 18 }}
          >
            No communities yet
          </Text>
          <Text
            className="font-sans text-center"
            style={{ color: '#78716C', fontSize: 14 }}
          >
            Create your first community or ask for an invite.
          </Text>
        </View>
      ) : (
        communities.map((c) => <CommunityCard key={c.id} community={c} />)
      )}

      <CreateCommunityCard />
    </ScrollView>
  );
}

// ─── Browse Communities list ─────────────────────────────────────────

function BrowseCommunities() {
  const { data, isLoading, isFetching, refetch } = useBrowseCommunities();
  useRefreshOnFocus(refetch);

  const communities = data?.data ?? [];

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#660000" />
      </View>
    );
  }

  if (communities.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <MaterialCommunityIcons name="compass-outline" size={48} color="#78716C" />
        <Text
          className="font-semibold mt-4 mb-2"
          style={{ color: '#1C1917', fontSize: 18 }}
        >
          Nothing to explore
        </Text>
        <Text
          className="font-sans text-center"
          style={{ color: '#78716C', fontSize: 14 }}
        >
          No discoverable communities right now. Check back later.
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={communities}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <CommunityCard community={item} browse />}
      contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 80 }}
      refreshControl={
        <RefreshControl
          refreshing={isFetching && !isLoading}
          onRefresh={() => refetch()}
          tintColor="#660000"
        />
      }
    />
  );
}

// ─── Main screen ─────────────────────────────────────────────────────

export default function CommunitiesScreen() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState<'my' | 'browse'>('my');

  // Logged-out state
  if (!user) {
    return (
      <View className="flex-1 justify-center items-center p-6" style={{ backgroundColor: '#FAF7F2' }}>
        <MaterialCommunityIcons name="account-group" size={48} color="#78716C" />
        <Text
          className="font-semibold mt-4 mb-2"
          style={{ color: '#1C1917', fontSize: 18 }}
        >
          Join communities
        </Text>
        <Text
          className="font-sans text-center mb-6"
          style={{ color: '#78716C', fontSize: 14 }}
        >
          Log in to discover and join communities near you.
        </Text>
        <Pressable
          className="px-6 py-3 rounded-2xl active:opacity-90"
          style={{ backgroundColor: '#660000' }}
          onPress={() => router.push('/auth/login')}
        >
          <Text className="font-semibold" style={{ color: '#FAF7F2', fontSize: 14 }}>
            Log in
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: '#FAF7F2' }}>
      <View className="px-4 pt-3 pb-2">
        <SegmentedTabs value={activeTab} onChange={setActiveTab} />
      </View>

      {activeTab === 'my' ? <MyCommunities /> : <BrowseCommunities />}
    </View>
  );
}
