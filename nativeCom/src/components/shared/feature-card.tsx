import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui/text';

interface FeatureCardProps {
  icon: string;
  title: string;
  description: string;
  onPress?: () => void;
}

/**
 * Feature card component for displaying features
 */
export function FeatureCard({ icon, title, description, onPress }: FeatureCardProps) {
  const content = (
    <View className="flex-1 border border-border rounded-xl p-4 bg-card">
      {/* Icon */}
      <View className="w-12 h-12 rounded-lg justify-center items-center mb-4 bg-rose-light">
        <Text className="text-2xl">{icon}</Text>
      </View>

      {/* Title */}
      <Text className="text-lg font-semibold mb-1">
        {title}
      </Text>

      {/* Description */}
      <Text className="text-xs leading-4 text-muted-foreground">
        {description}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className="flex-1 active:opacity-70"
      >
        {content}
      </Pressable>
    );
  }

  return <View className="flex-1">{content}</View>;
}
