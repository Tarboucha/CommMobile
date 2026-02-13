import { View } from 'react-native';
import { Text } from '@/components/ui/text';

export default function NotificationsScreen() {
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 justify-center items-center p-6 gap-4">
        <Text className="text-3xl font-bold text-center text-foreground">
          Notifications
        </Text>
        <Text className="text-base text-center text-muted-foreground">
          Your notifications will appear here
        </Text>
      </View>
    </View>
  );
}
