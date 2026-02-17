import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { NAV_COLORS } from '@/lib/constants/nav-colors';
import { getInviteLinkInfo, acceptInviteLink } from '@/lib/api/communities';
import type { InviteLinkInfo } from '@/types/community';

export default function InviteLinkScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { colorScheme } = useTheme();
  const navColors = NAV_COLORS[colorScheme];

  const [info, setInfo] = useState<InviteLinkInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadInfo();
    }
  }, [token]);

  async function loadInfo() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getInviteLinkInfo(token!);
      setInfo(data);
    } catch (err: any) {
      setError(err.message || 'Invalid or expired invite link.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleJoin() {
    if (!token) return;
    try {
      setIsJoining(true);
      await acceptInviteLink(token);
      Alert.alert('Joined!', 'You are now a member of this community.', [
        {
          text: 'Go to Community',
          onPress: () => {
            if (info?.community.id) {
              router.replace(`/community/${info.community.id}` as Href);
            } else {
              router.back();
            }
          },
        },
      ]);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to join community.');
    } finally {
      setIsJoining(false);
    }
  }

  function handleGoToCommunity() {
    if (info?.community.id) {
      router.replace(`/community/${info.community.id}` as Href);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Community Invite',
          headerStyle: { backgroundColor: navColors.card },
          headerTintColor: navColors.text,
          headerShadowVisible: false,
        }}
      />
      <View className="flex-1 bg-background justify-center items-center p-6">
        {isLoading ? (
          <ActivityIndicator size="large" />
        ) : error ? (
          <View className="items-center">
            <Ionicons name="alert-circle-outline" size={64} color="#DC2626" />
            <Text className="text-lg font-semibold text-foreground mt-4 mb-2">
              Invalid Invite
            </Text>
            <Text className="text-sm text-muted-foreground text-center mb-6">
              {error}
            </Text>
            <Pressable
              className="px-6 py-3 rounded-xl bg-muted active:bg-muted/80"
              onPress={() => router.back()}
            >
              <Text className="text-sm font-medium text-foreground">Go Back</Text>
            </Pressable>
          </View>
        ) : info ? (
          <View className="items-center w-full max-w-sm">
            {/* Community Icon */}
            <View className="w-20 h-20 rounded-2xl bg-primary/10 justify-center items-center mb-4">
              <Ionicons name="people" size={36} color="#660000" />
            </View>

            {/* Community Info */}
            <Text className="text-2xl font-bold text-foreground text-center mb-2">
              {info.community.community_name}
            </Text>

            {info.community.community_description && (
              <Text className="text-sm text-muted-foreground text-center mb-4 px-4">
                {info.community.community_description}
              </Text>
            )}

            {/* Stats */}
            <View className="flex-row gap-4 mb-8">
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">
                  {info.community.current_members_count ?? 0}
                </Text>
                <Text className="text-xs text-muted-foreground">Members</Text>
              </View>
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">
                  {info.community.max_members ?? 100}
                </Text>
                <Text className="text-xs text-muted-foreground">Max</Text>
              </View>
            </View>

            {/* Action */}
            {info.is_already_member ? (
              <View className="w-full">
                <View className="p-4 rounded-xl bg-muted mb-4">
                  <Text className="text-sm text-muted-foreground text-center">
                    You're already a member of this community.
                  </Text>
                </View>
                <Pressable
                  className="p-4 rounded-xl bg-primary active:bg-primary/80"
                  onPress={handleGoToCommunity}
                >
                  <Text className="text-sm font-semibold text-primary-foreground text-center">
                    Go to Community
                  </Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                className="w-full p-4 rounded-xl bg-primary active:bg-primary/80"
                onPress={handleJoin}
                disabled={isJoining}
              >
                {isJoining ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-sm font-semibold text-primary-foreground text-center">
                    Join Community
                  </Text>
                )}
              </Pressable>
            )}
          </View>
        ) : null}
      </View>
    </>
  );
}
