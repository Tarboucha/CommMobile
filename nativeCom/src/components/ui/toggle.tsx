import { Icon } from '@/components/ui/icon';
import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as TogglePrimitive from '@rn-primitives/toggle';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';
import { Platform } from 'react-native';

const toggleVariants = cva(
  cn(
    'active:bg-neutral-100 group flex flex-row items-center justify-center gap-2 rounded-md dark:active:bg-neutral-800',
    Platform.select({
      web: 'hover:bg-neutral-100 hover:text-neutral-500 focus-visible:border-neutral-950 focus-visible:ring-neutral-950/50 aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500 inline-flex cursor-default whitespace-nowrap outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:pointer-events-none [&_svg]:pointer-events-none dark:hover:bg-neutral-800 dark:hover:text-neutral-400 dark:focus-visible:border-neutral-300 dark:focus-visible:ring-neutral-300/50 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900',
    })
  ),
  {
    variants: {
      variant: {
        default: 'bg-transparent',
        outline: cn(
          'border-neutral-200 active:bg-neutral-100 border bg-transparent shadow-sm shadow-black/5 dark:border-neutral-800 dark:active:bg-neutral-800',
          Platform.select({
            web: 'hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-50',
          })
        ),
      },
      size: {
        default: 'h-10 min-w-10 px-2.5 sm:h-9 sm:min-w-9 sm:px-2',
        sm: 'h-9 min-w-9 px-2 sm:h-8 sm:min-w-8 sm:px-1.5',
        lg: 'h-11 min-w-11 px-3 sm:h-10 sm:min-w-10 sm:px-2.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function Toggle({
  className,
  variant,
  size,
  ...props
}: TogglePrimitive.RootProps &
  VariantProps<typeof toggleVariants> &
  React.RefAttributes<TogglePrimitive.RootRef>) {
  return (
    <TextClassContext.Provider
      value={cn(
        'text-sm text-neutral-950 font-medium dark:text-neutral-50',
        props.pressed
          ? 'text-neutral-900 dark:text-neutral-50'
          : Platform.select({ web: 'group-hover:text-neutral-500 dark:group-hover:text-neutral-400' }),
        className
      )}>
      <TogglePrimitive.Root
        className={cn(
          toggleVariants({ variant, size }),
          props.disabled && 'opacity-50',
          props.pressed && 'bg-neutral-100 dark:bg-neutral-800',
          className
        )}
        {...props}
      />
    </TextClassContext.Provider>
  );
}

function ToggleIcon({ className, ...props }: React.ComponentProps<typeof Icon>) {
  const textClass = React.useContext(TextClassContext);
  return <Icon className={cn('size-4 shrink-0', textClass, className)} {...props} />;
}

export { Toggle, ToggleIcon, toggleVariants };
