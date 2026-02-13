import { View, ViewStyle } from 'react-native';
import { Text } from '@/components/ui/text';

interface SectionContainerProps {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  backgroundColor?: string;
  style?: ViewStyle;
}

/**
 * Wrapper component for page sections with consistent spacing and optional header
 */
export function SectionContainer({
  title,
  subtitle,
  children,
  backgroundColor,
  style,
}: SectionContainerProps) {
  return (
    <View
      className="py-8 px-4"
      style={[
        backgroundColor ? { backgroundColor } : undefined,
        style,
      ]}
    >
      {(title || subtitle) && (
        <View className="mb-6 items-center">
          {title && (
            <Text className="text-xl font-bold text-center mb-2">
              {title}
            </Text>
          )}
          {subtitle && (
            <Text className="text-base text-center max-w-[600px] text-muted-foreground">
              {subtitle}
            </Text>
          )}
        </View>
      )}
      {children}
    </View>
  );
}
