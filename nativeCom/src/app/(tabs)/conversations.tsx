import { View } from 'react-native';
import { Text } from '@/components/ui/text';

export default function ConversationsScreen() {
  return (
    <View className="flex-1 bg-background">
      <View className="flex-1 justify-center items-center p-6 gap-4">
        <View className="w-20 h-20 rounded-full justify-center items-center mb-2 bg-muted">
          <Text className="text-4xl">💬</Text>
        </View>

        <Text className="text-3xl font-bold text-center text-foreground">
          Conversations
        </Text>

        <View className="px-4 py-1.5 rounded-full bg-primary/20">
          <Text className="text-sm font-semibold text-primary">
            Coming Soon
          </Text>
        </View>

        <Text className="text-base text-center max-w-[300px] text-muted-foreground">
          Chat with providers, community members, and manage your conversations.
        </Text>
      </View>
    </View>
  );
}
