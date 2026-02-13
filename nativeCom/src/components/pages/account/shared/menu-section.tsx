import { View, ViewStyle } from 'react-native';
import { Text } from '@/components/ui/text';

interface MenuSectionProps {
  title?: string;
  children: React.ReactNode;
  style?: ViewStyle;
  noCard?: boolean;
}

/**
 * Menu section component for grouping menu items
 * Optionally displays a section title
 * Use noCard={true} to render children without card wrapper
 */
export function MenuSection({ title, children, style, noCard = false }: MenuSectionProps) {
  return (
    <View className="mb-6" style={style}>
      {title && (
        <Text className="text-xs font-semibold uppercase tracking-wide mb-3 ml-4 text-muted-foreground">
          {title}
        </Text>
      )}
      {noCard ? (
        <View className="px-4">{children}</View>
      ) : (
        <View className="rounded-xl border border-border overflow-hidden bg-card">
          {children}
        </View>
      )}
    </View>
  );
}
