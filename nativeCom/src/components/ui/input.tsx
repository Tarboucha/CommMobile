import { cn } from '@/lib/utils';
import { Platform, TextInput, type TextInputProps } from 'react-native';

function Input({ className, ...props }: TextInputProps & React.RefAttributes<TextInput>) {
  return (
    <TextInput
      className={cn(
        'dark:bg-neutral-200/30 border-neutral-200 bg-white text-neutral-950 flex h-10 w-full min-w-0 flex-row items-center rounded-md border px-3 py-1 text-base leading-5 shadow-sm shadow-black/5 sm:h-9 dark:dark:bg-neutral-800/30 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-50',
        props.editable === false &&
          cn(
            'opacity-50',
            Platform.select({ web: 'disabled:pointer-events-none disabled:cursor-not-allowed' })
          ),
        Platform.select({
          web: cn(
            'placeholder:text-neutral-500 selection:bg-neutral-900 selection:text-neutral-50 outline-none transition-[color,box-shadow] md:text-sm dark:placeholder:text-neutral-400 dark:selection:bg-neutral-50 dark:selection:text-neutral-900',
            'focus-visible:border-neutral-950 focus-visible:ring-neutral-950/50 focus-visible:ring-[3px] dark:focus-visible:border-neutral-300 dark:focus-visible:ring-neutral-300/50',
            'aria-invalid:ring-red-500/20 dark:aria-invalid:ring-red-500/40 aria-invalid:border-red-500 dark:aria-invalid:ring-red-900/20 dark:dark:aria-invalid:ring-red-900/40 dark:aria-invalid:border-red-900'
          ),
          native: 'placeholder:text-neutral-500/50 dark:placeholder:text-neutral-400/50',
        }),
        className
      )}
      {...props}
    />
  );
}

export { Input };
