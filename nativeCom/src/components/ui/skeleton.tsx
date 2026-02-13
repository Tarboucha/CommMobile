import { cn } from '@/lib/utils';
import { View } from 'react-native';

function Skeleton({
  className,
  ...props
}: React.ComponentProps<typeof View> & React.RefAttributes<View>) {
  return <View className={cn('bg-neutral-100 animate-pulse rounded-md dark:bg-neutral-800', className)} {...props} />;
}

export { Skeleton };
