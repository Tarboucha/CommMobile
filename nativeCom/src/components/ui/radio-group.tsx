import { cn } from '@/lib/utils';
import * as RadioGroupPrimitive from '@rn-primitives/radio-group';
import { Platform } from 'react-native';

function RadioGroup({
  className,
  ...props
}: RadioGroupPrimitive.RootProps & React.RefAttributes<RadioGroupPrimitive.RootRef>) {
  return <RadioGroupPrimitive.Root className={cn('gap-3', className)} {...props} />;
}

function RadioGroupItem({
  className,
  ...props
}: RadioGroupPrimitive.ItemProps & React.RefAttributes<RadioGroupPrimitive.ItemRef>) {
  return (
    <RadioGroupPrimitive.Item
      className={cn(
        'border-neutral-200 dark:bg-neutral-200/30 aspect-square size-4 shrink-0 items-center justify-center rounded-full border shadow-sm shadow-black/5 dark:border-neutral-800 dark:dark:bg-neutral-800/30',
        Platform.select({
          web: 'focus-visible:border-neutral-950 focus-visible:ring-neutral-950/50 aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500 outline-none transition-all focus-visible:ring-[3px] disabled:cursor-not-allowed dark:focus-visible:border-neutral-300 dark:focus-visible:ring-neutral-300/50 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900',
        }),
        props.disabled && 'opacity-50',
        className
      )}
      {...props}>
      <RadioGroupPrimitive.Indicator className="bg-neutral-900 size-2 rounded-full dark:bg-neutral-50" />
    </RadioGroupPrimitive.Item>
  );
}

export { RadioGroup, RadioGroupItem };
