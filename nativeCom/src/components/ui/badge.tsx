import { TextClassContext } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import * as Slot from '@rn-primitives/slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Platform, View, ViewProps } from 'react-native';

const badgeVariants = cva(
  cn(
    'border-neutral-200 group shrink-0 flex-row items-center justify-center gap-1 overflow-hidden rounded-full border px-2 py-0.5 dark:border-neutral-800',
    Platform.select({
      web: 'focus-visible:border-neutral-950 focus-visible:ring-neutral-950/50 aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500 w-fit whitespace-nowrap transition-[color,box-shadow] focus-visible:ring-[3px] [&>svg]:pointer-events-none [&>svg]:size-3 dark:focus-visible:border-neutral-300 dark:focus-visible:ring-neutral-300/50 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900',
    })
  ),
  {
    variants: {
      variant: {
        default: cn(
          'bg-neutral-900 border-transparent dark:bg-neutral-50',
          Platform.select({ web: '[a&]:hover:bg-neutral-900/90 dark:[a&]:hover:bg-neutral-50/90' })
        ),
        secondary: cn(
          'bg-neutral-100 border-transparent dark:bg-neutral-800',
          Platform.select({ web: '[a&]:hover:bg-neutral-100/90 dark:[a&]:hover:bg-neutral-800/90' })
        ),
        destructive: cn(
          'bg-red-500 border-transparent dark:bg-red-900',
          Platform.select({ web: '[a&]:hover:bg-red-500/90 dark:[a&]:hover:bg-red-900/90' })
        ),
        outline: Platform.select({ web: '[a&]:hover:bg-neutral-100 [a&]:hover:text-neutral-900 dark:[a&]:hover:bg-neutral-800 dark:[a&]:hover:text-neutral-50' }),
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

const badgeTextVariants = cva('text-xs font-medium', {
  variants: {
    variant: {
      default: 'text-neutral-50 dark:text-neutral-900',
      secondary: 'text-neutral-900 dark:text-neutral-50',
      destructive: 'text-white',
      outline: 'text-neutral-950 dark:text-neutral-50',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

type BadgeProps = ViewProps &
  React.RefAttributes<View> & {
    asChild?: boolean;
  } & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, asChild, ...props }: BadgeProps) {
  const Component = asChild ? Slot.View : View;
  return (
    <TextClassContext.Provider value={badgeTextVariants({ variant })}>
      <Component className={cn(badgeVariants({ variant }), className)} {...props} />
    </TextClassContext.Provider>
  );
}

export { Badge, badgeTextVariants, badgeVariants };
export type { BadgeProps };
