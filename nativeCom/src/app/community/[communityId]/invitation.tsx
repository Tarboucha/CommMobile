import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { NAV_COLORS } from '@/lib/constants/nav-colors';
import { getCommunity, respondToInvitation } from '@/lib/api/communities';
import type { Community } from '@/types/community';

export default function InvitationScreen() {
  const { communityId, invitationId } = useLocalSearchParams<{
    communityId: string;
    invitationId: string;
  }>();
  const { colorScheme } = useTheme();
  const navColors = NAV_COLORS[colorScheme];

  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isResponding, setIsResponding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (communityId) {
      loadCommunity();
    }
  }, [communityId]);

  async function loadCommunity() {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCommunity(communityId!);
      setCommunity(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load community info.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRespond(action: 'accept' | 'decline') {
    if (!communityId || !invitationId) return;
    try {
      setIsResponding(true);
      await respondToInvitation(communityId, invitationId, action);

      if (action === 'accept') {
        Alert.alert('Joined!', 'You are now a member of this community.', [
          {
            text: 'Go to Community',
            onPress: () => router.replace(`/community/${communityId}` as Href),
          },
        ]);
      } else {
        Alert.alert('Declined', 'You have declined the invitation.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || `Failed to ${action} invitation.`);
    } finally {
      setIsResponding(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Community Invitation',
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
              Something went wrong
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
        ) : community ? (
          <View className="items-center w-full max-w-sm">
            {/* Community Icon */}
            <View className="w-20 h-20 rounded-2xl bg-primary/10 justify-center items-center mb-4">
              <Ionicons name="people" size={36} color="#660000" />
            </View>

            {/* Community Info */}
            <Text className="text-2xl font-bold text-foreground text-center mb-2">
              {community.community_name}
            </Text>

            {community.community_description && (
              <Text className="text-sm text-muted-foreground text-center mb-4 px-4">
                {community.community_description}
              </Text>
            )}

            {/* Stats */}
            <View className="flex-row gap-4 mb-4">
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">
                  {community.current_members_count ?? 0}
                </Text>
                <Text className="text-xs text-muted-foreground">Members</Text>
              </View>
              <View className="items-center">
                <Text className="text-lg font-bold text-foreground">
                  {community.max_members ?? 100}
                </Text>
                <Text className="text-xs text-muted-foreground">Max</Text>
              </View>
            </View>

            <Text className="text-sm text-muted-foreground text-center mb-8">
              You've been invited to join this community.
            </Text>

            {/* Actions */}
            <View className="w-full gap-3">
              <Pressable
                className="p-4 rounded-xl bg-primary active:bg-primary/80"
                onPress={() => handleRespond('accept')}
                disabled={isResponding}
              >
                {isResponding ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-sm font-semibold text-primary-foreground text-center">
                    Accept Invitation
                  </Text>
                )}
              </Pressable>
              <Pressable
                className="p-4 rounded-xl border border-border active:bg-muted/50"
                onPress={() => handleRespond('decline')}
                disabled={isResponding}
              >
                <Text className="text-sm font-semibold text-foreground text-center">
                  Decline
                </Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </>
  );
}
