import { View, Image } from 'react-native';
import { Text } from '@/components/ui/text';
import { getPublicUrl } from '@/lib/utils/storage';

interface ProfileHeaderProps {
  user: {
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    avatar_url?: string | null;
  } | null;
}

export function ProfileHeader({ user }: ProfileHeaderProps) {
  if (!user) {
    return null;
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

  const getDisplayName = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    if (user.first_name) {
      return user.first_name;
    }
    return 'My Profile';
  };

  const avatarUrl = getPublicUrl(user.avatar_url);

  return (
    <View className="flex-row items-center p-4 rounded-xl mb-6 bg-muted">
      <View className="w-16 h-16 rounded-full justify-center items-center mr-4 overflow-hidden bg-primary">
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            className="w-16 h-16"
          />
        ) : (
          <Text className="text-2xl font-semibold text-primary-foreground">
            {getInitials()}
          </Text>
        )}
      </View>

      <View className="flex-1">
        <Text className="text-lg font-semibold mb-0.5">{getDisplayName()}</Text>
        <Text className="text-sm text-muted-foreground">
          {user.email ?? ''}
        </Text>
      </View>
    </View>
  );
}
