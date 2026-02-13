import { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
} from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getCommunities, browseCommunities } from '@/lib/api/communities';
import type { Community } from '@/types/community';

// ─── Shared sub-components ──────────────────────────────────────────

function AccessBadge({ type }: { type: string | null }) {
  const label =
    type === 'open'
      ? 'Open'
      : type === 'request_to_join'
        ? 'Request'
        : 'Invite Only';

  return (
    <View className="px-2 py-0.5 rounded-full bg-muted">
      <Text className="text-xs text-muted-foreground">{label}</Text>
    </View>
  );
}

function CommunityCard({ community, browse }: { community: Community; browse?: boolean }) {
  return (
    <Pressable
      className="mx-4 mb-3 p-4 rounded-xl border border-border bg-card active:bg-muted/50"
      onPress={() => router.push(`/community/${community.id}` as Href)}
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1 mr-3">
          <Text className="text-base font-semibold text-foreground" numberOfLines={1}>
            {community.community_name}
          </Text>
        </View>
        <AccessBadge type={community.access_type} />
      </View>

      {community.community_description && (
        <Text className="text-sm text-muted-foreground mb-3" numberOfLines={2}>
          {community.community_description}
        </Text>
      )}

      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Ionicons name="people-outline" size={14} color="#78716C" />
          <Text className="text-xs text-muted-foreground ml-1">
            {browse
              ? `${community.current_members_count ?? 0} / ${community.max_members ?? '∞'} members`
              : `${community.current_members_count ?? 0} members`}
          </Text>
        </View>
        {browse && (
          <Text className="text-xs font-medium text-primary">
            {community.access_type === 'open' ? 'Join' : 'Request to Join'}
          </Text>
        )}
      </View>
    </Pressable>
  );
}

// ─── My Communities list ─────────────────────────────────────────────

function MyCommunities() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const result = await getCommunities();
      setCommunities(result.data);
    } catch (err) {
      console.error('Failed to fetch communities:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchData();
    }, [fetchData])
  );

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (communities.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Ionicons name="people-outline" size={48} color="#78716C" />
        <Text className="text-lg font-semibold text-foreground mt-4 mb-2">
          No Communities Yet
        </Text>
        <Text className="text-sm text-muted-foreground text-center mb-6">
          Create your first community or ask for an invite.
        </Text>
        <Pressable
          className="px-6 py-3 rounded-xl bg-primary active:bg-primary/80"
          onPress={() => router.push('/community/create' as Href)}
        >
          <Text className="text-sm font-semibold text-primary-foreground">
            Create Community
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <FlatList
      data={communities}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <CommunityCard community={item} />}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => { setIsRefreshing(true); fetchData(); }}
        />
      }
    />
  );
}

// ─── Browse Communities list ─────────────────────────────────────────

function BrowseCommunities() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const result = await browseCommunities();
      setCommunities(result.data);
    } catch (err) {
      console.error('Failed to browse communities:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      fetchData();
    }, [fetchData])
  );

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (communities.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-6">
        <Ionicons name="compass-outline" size={48} color="#78716C" />
        <Text className="text-lg font-semibold text-foreground mt-4 mb-2">
          Nothing to Browse
        </Text>
        <Text className="text-sm text-muted-foreground text-center">
          No discoverable communities right now. Check back later!
        </Text>
      </View>
    );
  }

  return (
    <FlatList
      data={communities}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <CommunityCard community={item} browse />}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 80 }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => { setIsRefreshing(true); fetchData(); }}
        />
      }
    />
  );
}

// ─── Main screen ─────────────────────────────────────────────────────

export default function CommunitiesScreen() {
  const user = useAuthStore((s) => s.user);
  const [activeTab, setActiveTab] = useState('my');

  // Logged-out state
  if (!user) {
    return (
      <View className="flex-1 bg-background justify-center items-center p-6">
        <Ionicons name="people" size={48} color="#78716C" />
        <Text className="text-lg font-semibold text-foreground mt-4 mb-2">
          Join Communities
        </Text>
        <Text className="text-sm text-muted-foreground text-center mb-6">
          Log in to discover and join communities near you.
        </Text>
        <Pressable
          className="px-6 py-3 rounded-xl bg-primary active:bg-primary/80"
          onPress={() => router.push('/auth/login')}
        >
          <Text className="text-sm font-semibold text-primary-foreground">Log In</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
        <View className="px-4 pt-3 pb-1">
          <TabsList className="w-full">
            <TabsTrigger value="my" className="flex-1">
              <Text>My Communities</Text>
            </TabsTrigger>
            <TabsTrigger value="browse" className="flex-1">
              <Text>Browse</Text>
            </TabsTrigger>
          </TabsList>
        </View>

        <TabsContent value="my" className="flex-1">
          <MyCommunities />
        </TabsContent>

        <TabsContent value="browse" className="flex-1">
          <BrowseCommunities />
        </TabsContent>
      </Tabs>

      {/* FAB — create community */}
      <Pressable
        className="absolute bottom-6 right-6 w-14 h-14 rounded-full bg-primary justify-center items-center shadow-lg"
        onPress={() => router.push('/community/create' as Href)}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}
