import { ScrollView, Pressable, View, Image } from 'react-native';
import { router, Stack } from 'expo-router';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/stores/auth-store';
import { InfoRow } from '@/components/pages/account/shared/info-row';
import { getPublicUrl } from '@/lib/utils/storage';

export default function ProfileScreen() {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: 'Profile' }} />
        <View className="flex-1 bg-background justify-center items-center">
          <Text>Not logged in</Text>
        </View>
      </>
    );
  }

  const getInitials = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.first_name) {
      return user.first_name[0].toUpperCase();
    }
    return (user.email ?? '?')[0].toUpperCase();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'My Profile',
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View className="p-6 rounded-2xl items-center mb-8 bg-card">
          {/* Avatar */}
          <View className="w-24 h-24 rounded-full justify-center items-center mb-6 overflow-hidden bg-muted">
            {user.avatar_url ? (
              <Image
                source={{ uri: getPublicUrl(user.avatar_url) || '' }}
                className="w-24 h-24"
              />
            ) : (
              <Text className="text-4xl font-semibold text-foreground">
                {getInitials()}
              </Text>
            )}
          </View>

          {/* Info Section */}
          <View className="w-full gap-6">
            <InfoRow label="First Name" value={user.first_name || '-'} />
            <InfoRow label="Last Name" value={user.last_name || '-'} />
            <InfoRow label="Email" value={user.email ?? '-'} />
            <InfoRow label="Phone" value={user.phone || '-'} />
          </View>
        </View>

        {/* Edit Button */}
        <Pressable
          className="py-4 px-8 rounded-xl items-center mb-8 bg-primary"
          onPress={() => router.push('/account/profile/edit')}
        >
          <Text className="text-base font-semibold text-primary-foreground">
            Edit Profile
          </Text>
        </Pressable>
      </ScrollView>
    </>
  );
}
