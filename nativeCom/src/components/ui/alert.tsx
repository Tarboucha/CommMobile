import { Icon } from '@/components/ui/icon';
import { Text, TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react-native';
import * as React from 'react';
import { View, type ViewProps } from 'react-native';

function Alert({
  className,
  variant,
  children,
  icon,
  iconClassName,
  ...props
}: ViewProps &
  React.RefAttributes<View> & {
    icon: LucideIcon;
    variant?: 'default' | 'destructive';
    iconClassName?: string;
  }) {
  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm text-neutral-950 dark:text-neutral-50',
        variant === 'destructive' && 'text-red-500 dark:text-red-900',
        className
      )}>
      <View
        role="alert"
        className={cn(
          'bg-white border-neutral-200 relative w-full rounded-lg border px-4 pb-2 pt-3.5 dark:bg-neutral-950 dark:border-neutral-800',
          className
        )}
        {...props}>
        <View className="absolute left-3.5 top-3">
          <Icon
            as={icon}
            className={cn('size-4', variant === 'destructive' && 'text-red-500 dark:text-red-900', iconClassName)}
          />
        </View>
        {children}
      </View>
    </TextClassContext.Provider>
  );
}

function AlertTitle({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  return (
    <Text
      className={cn('mb-1 ml-0.5 min-h-4 pl-6 font-medium leading-none tracking-tight', className)}
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<typeof Text> & React.RefAttributes<Text>) {
  const textClass = React.useContext(TextClassContext);
  return (
    <Text
      className={cn(
        'text-neutral-500 ml-0.5 pb-1.5 pl-6 text-sm leading-relaxed dark:text-neutral-400',
        textClass?.includes('text-red-500 dark:text-red-900') && 'text-red-500/90 dark:text-red-900/90',
        className
      )}
      {...props}
    />
  );
}

export { Alert, AlertDescription, AlertTitle };
