import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { NAV_COLORS } from '@/lib/constants/nav-colors';
import { getCommunity, joinCommunity, leaveCommunity } from '@/lib/api/communities';
import { ChatTab } from '@/components/pages/community/chat-tab';
import { BoardTab } from '@/components/pages/community/board-tab';
import { InfoTab } from '@/components/pages/community/info-tab';
import type { Community } from '@/types/community';

export default function CommunityDetailScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const user = useAuthStore((s) => s.user);
  const { colorScheme } = useTheme();
  const navColors = NAV_COLORS[colorScheme];

  const [community, setCommunity] = useState<Community | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<string | null>(null);

  useEffect(() => {
    if (communityId) {
      loadCommunity();
    }
  }, [communityId]);

  async function loadCommunity() {
    try {
      setIsLoading(true);
      const data = await getCommunity(communityId!);
      setCommunity(data);
    } catch (err) {
      console.error('Failed to load community:', err);
    } finally {
      setIsLoading(false);
    }
  }

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

  const isMember = user && community.created_by_profile_id === user.id;
  const defaultTab = isMember ? 'chat' : 'info';

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: community.community_name,
          headerStyle: { backgroundColor: navColors.card },
          headerTintColor: navColors.text,
          headerShadowVisible: false,
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
              <TabsTrigger value="chat" className="flex-1">
                <Text>Chat</Text>
              </TabsTrigger>
              <TabsTrigger value="board" className="flex-1">
                <Text>Board</Text>
              </TabsTrigger>
              <TabsTrigger value="info" className="flex-1">
                <Text>Info</Text>
              </TabsTrigger>
            </TabsList>
          </View>

          <TabsContent value="chat" className="flex-1">
            <ChatTab
              communityId={communityId!}
              isMember={!!isMember}
              userId={user?.id ?? null}
            />
          </TabsContent>

          <TabsContent value="board" className="flex-1">
            <BoardTab />
          </TabsContent>

          <TabsContent value="info" className="flex-1">
            <InfoTab
              community={community}
              communityId={communityId!}
              isMember={!!isMember}
              user={user}
              actionLoading={actionLoading}
              onJoin={handleJoin}
              onLeave={handleLeave}
            />
          </TabsContent>
        </Tabs>
      </View>
    </>
  );
}
