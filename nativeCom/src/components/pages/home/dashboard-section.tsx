import { View, Pressable, Image, ScrollView } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { getPublicUrl } from '@/lib/utils/storage';

interface DashboardUser {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  avatar_url?: string | null;
}

interface StatCardProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onPress: () => void;
}

function StatCard({ icon, label, value, onPress }: StatCardProps) {
  return (
    <Pressable
      className="flex-1 p-4 rounded-xl border border-border bg-card active:bg-muted/50"
      onPress={onPress}
    >
      <Ionicons name={icon} size={24} color="#78716C" style={{ marginBottom: 8 }} />
      <Text className="text-2xl font-bold text-foreground">{value}</Text>
      <Text className="text-xs text-muted-foreground mt-1">{label}</Text>
    </Pressable>
  );
}

interface QuickActionProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

function QuickAction({ icon, label, onPress }: QuickActionProps) {
  return (
    <Pressable
      className="flex-1 flex-row items-center p-4 rounded-xl border border-border bg-card active:bg-muted/50"
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color="#78716C" style={{ marginRight: 10 }} />
      <Text className="text-sm font-medium text-foreground">{label}</Text>
    </Pressable>
  );
}

interface DashboardSectionProps {
  user: DashboardUser;
}

export function DashboardSection({ user }: DashboardSectionProps) {
  const avatarUrl = getPublicUrl(user.avatar_url);
  const firstName = user.first_name || 'there';

  const navigateTo = (path: string) => router.push(path as Href);

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="p-4 pb-12"
      showsVerticalScrollIndicator={false}
    >
      {/* Greeting */}
      <View className="flex-row items-center mb-6">
        <View className="w-12 h-12 rounded-full justify-center items-center mr-3 overflow-hidden bg-primary">
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} className="w-12 h-12" />
          ) : (
            <Text className="text-lg font-semibold text-primary-foreground">
              {(user.first_name ?? user.email ?? '?')[0].toUpperCase()}
            </Text>
          )}
        </View>
        <View>
          <Text className="text-xl font-bold text-foreground">Hello, {firstName}</Text>
          <Text className="text-sm text-muted-foreground">Welcome back</Text>
        </View>
      </View>

      {/* Stats Cards */}
      <View className="flex-row gap-3 mb-6">
        <StatCard
          icon="receipt-outline"
          label="Bookings"
          value="—"
          onPress={() => navigateTo('/account/bookings')}
        />
        <StatCard
          icon="heart-outline"
          label="Saved"
          value="—"
          onPress={() => navigateTo('/account/saved')}
        />
        <StatCard
          icon="people-outline"
          label="Communities"
          value="—"
          onPress={() => navigateTo('/communities')}
        />
      </View>

      {/* Quick Actions */}
      <Text className="text-xs font-semibold uppercase tracking-wide mb-3 text-muted-foreground">
        Quick Actions
      </Text>
      <View className="gap-3">
        <View className="flex-row gap-3">
          <QuickAction
            icon="search-outline"
            label="Browse Offerings"
            onPress={() => navigateTo('/communities')}
          />
          <QuickAction
            icon="receipt-outline"
            label="My Bookings"
            onPress={() => navigateTo('/account/bookings')}
          />
        </View>
        <View className="flex-row gap-3">
          <QuickAction
            icon="location-outline"
            label="My Addresses"
            onPress={() => navigateTo('/account/addresses')}
          />
          <QuickAction
            icon="notifications-outline"
            label="Notifications"
            onPress={() => navigateTo('/notifications')}
          />
        </View>
      </View>
    </ScrollView>
  );
}
