import { View, ViewStyle, TextStyle } from 'react-native';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';

type TagVariant = 'primary' | 'secondary' | 'muted' | 'success' | 'destructive' | 'featured';
type TagSize = 'sm' | 'md';

interface TagProps {
  children?: string;
  icon?: string | null;
  variant?: TagVariant;
  size?: TagSize;
  iconOnly?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

/**
 * Tag Component
 * Reusable tag/chip component with icon support and multiple variants
 *
 * @example
 * <Tag icon="🍕" variant="secondary">Italian</Tag>
 * <Tag icon="🔥" variant="muted">Grilling</Tag>
 * <Tag variant="success">Verified</Tag>
 * <Tag icon="⭐" variant="featured" iconOnly />
 */
export function Tag({
  children,
  icon,
  variant = 'secondary',
  size = 'sm',
  iconOnly = false,
  style,
  textStyle,
}: TagProps) {
  // Get variant-specific classes
  const getVariantClasses = (): string => {
    switch (variant) {
      case 'primary':
        return 'bg-primary/20 border-primary';
      case 'secondary':
        return 'bg-secondary border-border';
      case 'muted':
        return 'bg-muted border-border';
      case 'success':
        return 'bg-green-100 border-green-500';
      case 'destructive':
        return 'bg-destructive/20 border-destructive';
      case 'featured':
        return 'bg-amber-100 border-amber-500';
      default:
        return 'bg-secondary border-border';
    }
  };

  const getTextColorClass = (): string => {
    switch (variant) {
      case 'primary':
        return 'text-primary';
      case 'success':
        return 'text-green-700';
      case 'destructive':
        return 'text-destructive';
      case 'featured':
        return 'text-amber-700';
      default:
        return '';
    }
  };

  const sizeClasses = iconOnly
    ? 'px-1.5 py-1'
    : size === 'sm'
      ? 'px-2 py-1'
      : 'px-4 py-1.5';

  const textSizeClass = size === 'sm' ? 'text-xs' : 'text-sm';

  // Render content based on iconOnly mode
  const renderContent = () => {
    if (iconOnly && icon) {
      return (
        <Text className={cn('text-xs font-medium', getTextColorClass())} style={textStyle}>
          {icon}
        </Text>
      );
    }
    return (
      <Text className={cn('font-medium', textSizeClass, getTextColorClass())} style={textStyle}>
        {icon ? `${icon} ` : ''}{children}
      </Text>
    );
  };

  return (
    <View
      className={cn('rounded border', getVariantClasses(), sizeClasses)}
      style={style}
    >
      {renderContent()}
    </View>
  );
}
