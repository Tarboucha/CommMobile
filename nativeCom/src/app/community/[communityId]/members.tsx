import { useState, useEffect, useCallback } from 'react';
import {
  View,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  Image,
  Alert,
} from 'react-native';
import { useLocalSearchParams, Stack, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { getCommunityMembers } from '@/lib/api/communities';
import { getOrCreateDirectConversation } from '@/lib/api/chat';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { CommunityMember, MemberRole } from '@/types/community';

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-800',
  admin: 'bg-blue-100 text-blue-800',
  moderator: 'bg-purple-100 text-purple-800',
  member: 'bg-muted text-muted-foreground',
};

function RoleBadge({ role }: { role: MemberRole | null }) {
  const label = role ?? 'member';
  const colors = ROLE_COLORS[label] ?? ROLE_COLORS.member;
  const [bg, text] = colors.split(' ');

  return (
    <View className={`px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-xs capitalize ${text}`}>{label}</Text>
    </View>
  );
}

function getMemberName(member: CommunityMember): string {
  if (member.profiles) {
    const { first_name, last_name } = member.profiles;
    if (first_name || last_name) {
      return [first_name, last_name].filter(Boolean).join(' ');
    }
  }
  return member.profile_id.slice(0, 8) + '...';
}

function MemberItem({
  member,
  currentUserId,
  onMessage,
}: {
  member: CommunityMember;
  currentUserId: string | null;
  onMessage: (member: CommunityMember) => void;
}) {
  const isSelf = currentUserId === member.profile_id;
  const name = getMemberName(member);

  return (
    <View className="mx-4 mb-2 flex-row items-center p-3 rounded-xl border border-border bg-card">
      {member.profiles?.avatar_url ? (
        <Image
          source={{ uri: member.profiles.avatar_url }}
          className="w-10 h-10 rounded-full mr-3"
        />
      ) : (
        <View className="w-10 h-10 rounded-full bg-primary/10 justify-center items-center mr-3">
          <Ionicons name="person" size={18} color="#660000" />
        </View>
      )}
      <View className="flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-medium text-foreground">
            {name}
          </Text>
          {isSelf && (
            <Text className="text-xs text-muted-foreground">(You)</Text>
          )}
        </View>
        <Text className="text-xs text-muted-foreground">
          Joined {member.created_at ? new Date(member.created_at).toLocaleDateString() : 'N/A'}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <RoleBadge role={member.member_role} />
        {!isSelf && (
          <Pressable
            className="w-9 h-9 rounded-full bg-primary/10 justify-center items-center"
            onPress={() => onMessage(member)}
          >
            <Ionicons name="chatbubble-outline" size={16} color="#660000" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

export default function CommunityMembersScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (communityId) loadMembers();
  }, [communityId]);

  async function loadMembers() {
    try {
      setIsLoading(true);
      const result = await getCommunityMembers(communityId!);
      setMembers(result.data);
      setNextCursor(result.pagination.next_cursor);
    } catch (err) {
      console.error('Failed to load members:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    try {
      setLoadingMore(true);
      const result = await getCommunityMembers(communityId!, 20, nextCursor);
      setMembers((prev) => [...prev, ...result.data]);
      setNextCursor(result.pagination.next_cursor);
    } catch (err) {
      console.error('Failed to load more members:', err);
    } finally {
      setLoadingMore(false);
    }
  }

  const handleMessage = useCallback(async (member: CommunityMember) => {
    try {
      const conversation = await getOrCreateDirectConversation(member.profile_id);
      const name = getMemberName(member);
      router.push({
        pathname: '/conversations/[conversationId]',
        params: { conversationId: conversation.id, name },
      });
    } catch (err) {
      console.error('Failed to start conversation:', err);
      Alert.alert('Error', 'Could not start conversation. Please try again.');
    }
  }, [router]);

  if (isLoading) {
    return (
      <>
        <Stack.Screen options={{ headerShown: true, title: 'Members' }} />
        <View className="flex-1 bg-background justify-center items-center">
          <ActivityIndicator size="large" />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: `Members (${members.length})` }} />
      <FlatList
        className="flex-1 bg-background"
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MemberItem
            member={item}
            currentUserId={userId}
            onMessage={handleMessage}
          />
        )}
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              loadMembers();
            }}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" style={{ padding: 16 }} />
          ) : null
        }
        ListEmptyComponent={
          <View className="flex-1 justify-center items-center p-6">
            <Text className="text-sm text-muted-foreground">No members found.</Text>
          </View>
        }
      />
    </>
  );
}
