import { cn } from '@/lib/utils';
import * as SwitchPrimitives from '@rn-primitives/switch';
import { Platform } from 'react-native';

function Switch({
  className,
  ...props
}: SwitchPrimitives.RootProps & React.RefAttributes<SwitchPrimitives.RootRef>) {
  return (
    <SwitchPrimitives.Root
      className={cn(
        'flex h-[1.15rem] w-8 shrink-0 flex-row items-center rounded-full border border-neutral-200 border-transparent shadow-sm shadow-black/5 dark:border-neutral-800',
        Platform.select({
          web: 'focus-visible:border-neutral-950 focus-visible:ring-neutral-950/50 peer inline-flex outline-none transition-all focus-visible:ring-[3px] disabled:cursor-not-allowed dark:focus-visible:border-neutral-300 dark:focus-visible:ring-neutral-300/50',
        }),
        props.checked ? 'bg-neutral-900 dark:bg-neutral-50' : 'bg-neutral-200 dark:bg-neutral-200/80 dark:bg-neutral-800 dark:dark:bg-neutral-800/80',
        props.disabled && 'opacity-50',
        className
      )}
      {...props}>
      <SwitchPrimitives.Thumb
        className={cn(
          'bg-white size-4 rounded-full transition-transform dark:bg-neutral-950',
          Platform.select({
            web: 'pointer-events-none block ring-0',
          }),
          props.checked
            ? 'dark:bg-neutral-50 translate-x-3.5 dark:dark:bg-neutral-900'
            : 'dark:bg-neutral-950 translate-x-0 dark:dark:bg-neutral-50'
        )}
      />
    </SwitchPrimitives.Root>
  );
}

export { Switch };
