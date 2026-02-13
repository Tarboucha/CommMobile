import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Text } from '@/components/ui/text';

interface NotificationsBellProps {
  count?: number;
}

export function NotificationsBell({ count = 0 }: NotificationsBellProps) {
  return (
    <Pressable
      className="relative p-2"
      onPress={() => router.push('/notifications')}
    >
      <IconSymbol
        size={24}
        name="bell.fill"
        color="#1F2937"
      />
      {count > 0 && (
        <View className="absolute top-1 right-1 min-w-[18px] h-[18px] rounded-full justify-center items-center px-1 bg-destructive">
          <Text className="text-[10px] font-bold text-destructive-foreground">
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
