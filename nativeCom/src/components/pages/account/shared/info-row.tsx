import { View } from 'react-native';
import { Text } from '@/components/ui/text';

interface InfoRowProps {
  label: string;
  value: string;
}

/**
 * Info row component for displaying label-value pairs
 * Used in profile and detail screens
 */
export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <View className="gap-1 bg-transparent">
      <Text className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Text>
      <Text className="text-base">
        {value}
      </Text>
    </View>
  );
}
