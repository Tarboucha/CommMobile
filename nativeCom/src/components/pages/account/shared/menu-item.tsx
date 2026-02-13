import { Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface MenuItemProps {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'destructive';
  badge?: string;
  showBorder?: boolean;
}

/**
 * Menu item component for account navigation
 * Displays label and optional badge with chevron
 */
export function MenuItem({
  label,
  onPress,
  variant = 'default',
  badge,
  showBorder = true,
}: MenuItemProps) {
  const isDestructive = variant === 'destructive';

  return (
    <Pressable
      className={cn(
        'flex-row items-center px-6 py-4 min-h-[56px] active:opacity-70 active:bg-muted',
        showBorder && 'border-b border-border'
      )}
      onPress={onPress}
    >
      {/* Label */}
      <Text
        className={cn(
          'flex-1 text-base font-medium',
          isDestructive ? 'text-destructive' : 'text-foreground'
        )}
      >
        {label}
      </Text>

      {/* Badge (optional) */}
      {badge && (
        <Badge variant="default" className="mr-2">
          {badge}
        </Badge>
      )}

      {/* Chevron Right */}
      <Text className="text-2xl font-light text-muted-foreground">›</Text>
    </Pressable>
  );
}
