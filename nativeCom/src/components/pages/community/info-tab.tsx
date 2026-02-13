import { View, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import type { Community } from '@/types/community';

interface InfoTabProps {
  community: Community;
  communityId: string;
  isMember: boolean;
  user: { id: string } | null;
  actionLoading: boolean;
  onJoin: () => void;
  onLeave: () => void;
}

export function InfoTab({
  community,
  communityId,
  isMember,
  user,
  actionLoading,
  onJoin,
  onLeave,
}: InfoTabProps) {
  const accessLabel =
    community.access_type === 'open'
      ? 'Open'
      : community.access_type === 'request_to_join'
        ? 'Request to Join'
        : 'Invite Only';

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
    >
      {/* Header */}
      <View className="items-center mb-6">
        <View className="w-20 h-20 rounded-2xl bg-primary/10 justify-center items-center mb-4">
          <Ionicons name="people" size={36} color="#660000" />
        </View>
        <Text className="text-2xl font-bold text-foreground text-center">
          {community.community_name}
        </Text>
        {community.community_description && (
          <Text className="text-sm text-muted-foreground text-center mt-2 px-4">
            {community.community_description}
          </Text>
        )}
      </View>

      {/* Stats */}
      <View className="flex-row gap-3 mb-6">
        <View className="flex-1 p-4 rounded-xl border border-border bg-card items-center">
          <Ionicons name="people-outline" size={20} color="#78716C" />
          <Text className="text-lg font-bold text-foreground mt-1">
            {community.current_members_count ?? 0}
          </Text>
          <Text className="text-xs text-muted-foreground">Members</Text>
        </View>
        <View className="flex-1 p-4 rounded-xl border border-border bg-card items-center">
          <Ionicons name="shield-outline" size={20} color="#78716C" />
          <Text className="text-sm font-medium text-foreground mt-1">{accessLabel}</Text>
          <Text className="text-xs text-muted-foreground">Access</Text>
        </View>
        <View className="flex-1 p-4 rounded-xl border border-border bg-card items-center">
          <Ionicons name="people" size={20} color="#78716C" />
          <Text className="text-lg font-bold text-foreground mt-1">
            {community.max_members ?? 100}
          </Text>
          <Text className="text-xs text-muted-foreground">Max</Text>
        </View>
      </View>

      {/* View Members */}
      <Pressable
        className="flex-row items-center justify-between p-4 rounded-xl border border-border bg-card mb-4 active:bg-muted/50"
        onPress={() => router.push(`/community/${communityId}/members` as Href)}
      >
        <View className="flex-row items-center">
          <Ionicons name="people-outline" size={20} color="#78716C" />
          <Text className="text-sm font-medium text-foreground ml-3">View Members</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color="#78716C" />
      </Pressable>

      {/* Action Button */}
      {user && (
        <View className="mt-4">
          {isMember ? (
            <Pressable
              className="p-4 rounded-xl border border-destructive active:bg-destructive/10"
              onPress={onLeave}
              disabled={actionLoading}
            >
              <Text className="text-sm font-semibold text-destructive text-center">
                {actionLoading ? 'Leaving...' : 'Leave Community'}
              </Text>
            </Pressable>
          ) : community.access_type !== 'invite_only' ? (
            <Pressable
              className="p-4 rounded-xl bg-primary active:bg-primary/80"
              onPress={onJoin}
              disabled={actionLoading}
            >
              <Text className="text-sm font-semibold text-primary-foreground text-center">
                {actionLoading
                  ? 'Joining...'
                  : community.access_type === 'request_to_join'
                    ? 'Request to Join'
                    : 'Join Community'}
              </Text>
            </Pressable>
          ) : (
            <View className="p-4 rounded-xl bg-muted">
              <Text className="text-sm text-muted-foreground text-center">
                This community is invite only.
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
