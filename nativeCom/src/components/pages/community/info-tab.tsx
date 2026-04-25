import { View, ScrollView, Pressable, Image } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import type { Community, CommunityMember } from '@/types/community';

interface InfoTabProps {
  community: Community;
  communityId: string;
  isMember: boolean;
  isOwnerOrAdmin: boolean;
  canPostOfferings: boolean;
  user: { id: string } | null;
  actionLoading: boolean;
  members: CommunityMember[];
  onJoin: () => void;
  onLeave: () => void;
  onInvite: () => void;
}

export function InfoTab({
  community,
  communityId,
  isMember,
  isOwnerOrAdmin,
  canPostOfferings,
  user,
  actionLoading,
  members,
  onJoin,
  onLeave,
  onInvite,
}: InfoTabProps) {
  const totalMembers = community.current_members_count ?? members.length;
  const previewMembers = members.slice(0, 5);
  const stewards = members
    .filter((m) => m.member_role === 'owner' || m.member_role === 'admin')
    .slice(0, 4);

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: '#FAF7F2' }}
      contentContainerStyle={{ padding: 24, paddingBottom: 64 }}
    >
      {/* Description */}
      {community.community_description && (
        <View className="mb-7">
          <Text
            className="font-bold mb-3"
            style={{ color: '#1C1917', fontSize: 20, lineHeight: 26 }}
          >
            About
          </Text>
          <Text
            className="font-sans"
            style={{ color: '#58413E', fontSize: 16, lineHeight: 26 }}
          >
            {community.community_description}
          </Text>
        </View>
      )}

      {/* Members preview */}
      <Pressable
        onPress={() => router.push(`/community/${communityId}/members` as Href)}
        className="py-5 active:opacity-80"
        style={{ borderTopWidth: 1, borderTopColor: '#E8D5D5' }}
      >
        <View className="flex-row items-center justify-between mb-4">
          <Text
            className="font-semibold uppercase"
            style={{ color: '#78716C', fontSize: 11, letterSpacing: 1.5 }}
          >
            Community members
          </Text>
          <View className="flex-row items-center gap-1">
            <Text
              className="font-semibold"
              style={{ color: '#660000', fontSize: 13 }}
            >
              View all {totalMembers}
            </Text>
            <MaterialCommunityIcons name="arrow-right" size={14} color="#660000" />
          </View>
        </View>

        <View className="flex-row items-center">
          {previewMembers.map((m, i) => (
            <MemberAvatar
              key={m.id}
              profile={m.profiles}
              offsetClass={i > 0 ? '-ml-3' : ''}
            />
          ))}
          {totalMembers > previewMembers.length && (
            <View
              className="-ml-3 w-10 h-10 rounded-full items-center justify-center"
              style={{
                backgroundColor: '#F5E6D3',
                borderWidth: 2,
                borderColor: '#FAF7F2',
              }}
            >
              <Text
                className="font-bold"
                style={{ color: '#660000', fontSize: 11 }}
              >
                +{totalMembers - previewMembers.length}
              </Text>
            </View>
          )}
        </View>
      </Pressable>

      {/* Stewards */}
      {stewards.length > 0 && (
        <View
          className="py-5"
          style={{ borderTopWidth: 1, borderTopColor: '#E8D5D5' }}
        >
          <Text
            className="font-semibold uppercase mb-4"
            style={{ color: '#78716C', fontSize: 11, letterSpacing: 1.5 }}
          >
            Community stewards
          </Text>
          <View className="gap-4">
            {stewards.map((s) => (
              <View key={s.id} className="flex-row items-center gap-4">
                <MemberAvatar profile={s.profiles} size={48} />
                <View className="flex-1 min-w-0">
                  <Text
                    className="font-semibold"
                    style={{ color: '#1C1917', fontSize: 15 }}
                    numberOfLines={1}
                  >
                    {memberName(s.profiles)}
                  </Text>
                  <Text
                    className="font-sans"
                    style={{ color: '#78716C', fontSize: 13 }}
                  >
                    {s.member_role === 'owner' ? 'Owner' : 'Admin'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Actions */}
      <View
        className="pt-6 gap-3"
        style={{ borderTopWidth: 1, borderTopColor: '#E8D5D5' }}
      >
        {isMember && (isOwnerOrAdmin || community.allow_member_invites) && (
          <ActionRow
            icon="account-plus-outline"
            label="Invite members"
            onPress={onInvite}
          />
        )}

        {isMember && canPostOfferings && (
          <ActionRow
            icon="plus-circle-outline"
            label="Post an offering"
            onPress={() =>
              router.push(`/community/${communityId}/offerings/new` as Href)
            }
          />
        )}

        {/* Primary CTA */}
        {user && (
          <View className="mt-3">
            {isMember ? (
              <Pressable
                onPress={onLeave}
                disabled={actionLoading}
                className="rounded-2xl h-14 items-center justify-center active:opacity-90"
                style={{
                  backgroundColor: 'transparent',
                  borderWidth: 1.5,
                  borderColor: '#DC2626',
                  opacity: actionLoading ? 0.6 : 1,
                }}
              >
                <Text
                  className="font-semibold"
                  style={{ color: '#DC2626', fontSize: 15 }}
                >
                  {actionLoading ? 'Leaving…' : 'Leave community'}
                </Text>
              </Pressable>
            ) : community.access_type !== 'invite_only' ? (
              <Pressable
                onPress={onJoin}
                disabled={actionLoading}
                className="rounded-2xl h-14 items-center justify-center active:opacity-90"
                style={{
                  backgroundColor: '#660000',
                  opacity: actionLoading ? 0.7 : 1,
                  shadowColor: '#4a352f',
                  shadowOffset: { width: 0, height: 8 },
                  shadowOpacity: 0.15,
                  shadowRadius: 16,
                  elevation: 4,
                }}
              >
                <Text
                  className="font-semibold"
                  style={{ color: '#FAF7F2', fontSize: 15 }}
                >
                  {actionLoading
                    ? 'Joining…'
                    : community.access_type === 'request_to_join'
                      ? 'Request to join'
                      : 'Join community'}
                </Text>
              </Pressable>
            ) : (
              <View
                className="rounded-2xl py-4 items-center"
                style={{ backgroundColor: '#F5E6D3' }}
              >
                <Text
                  className="font-sans"
                  style={{ color: '#78716C', fontSize: 14 }}
                >
                  This community is invite only.
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────

function memberName(profile: CommunityMember['profiles']) {
  if (!profile) return 'Unknown member';
  const first = profile.first_name ?? '';
  const last = profile.last_name ?? '';
  const full = `${first} ${last}`.trim();
  return full || 'Member';
}

function MemberAvatar({
  profile,
  size = 40,
  offsetClass = '',
}: {
  profile: CommunityMember['profiles'];
  size?: number;
  offsetClass?: string;
}) {
  const initial = (memberName(profile)?.[0] ?? '•').toUpperCase();

  if (profile?.avatar_url) {
    return (
      <Image
        source={{ uri: profile.avatar_url }}
        className={offsetClass}
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: '#FAF7F2',
        }}
      />
    );
  }

  return (
    <View
      className={`${offsetClass} items-center justify-center`}
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#F5E6D3',
        borderWidth: 2,
        borderColor: '#FAF7F2',
      }}
    >
      <Text
        className="font-bold"
        style={{ color: '#660000', fontSize: size * 0.4 }}
      >
        {initial}
      </Text>
    </View>
  );
}

function ActionRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 rounded-2xl px-5 py-4 active:opacity-80"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <MaterialCommunityIcons name={icon} size={20} color="#660000" />
      <Text
        className="flex-1 font-semibold"
        style={{ color: '#1C1917', fontSize: 15 }}
      >
        {label}
      </Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color="#A8A29E" />
    </Pressable>
  );
}
