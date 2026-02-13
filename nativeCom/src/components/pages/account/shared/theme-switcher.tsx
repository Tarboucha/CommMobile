import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import { useTheme } from '@/hooks/use-theme';
import { cn } from '@/lib/utils';

export function ThemeSwitcher() {
  const { colorScheme, setThemeMode } = useTheme();
  const isLight = colorScheme === 'light';

  return (
    <View className="py-2">
      <View className="flex-row rounded-lg border border-border overflow-hidden">
        {/* Light Option */}
        <Pressable
          className={cn(
            'flex-1 py-3 px-4 justify-center items-center',
            isLight ? 'bg-primary' : 'bg-background'
          )}
          onPress={() => setThemeMode('light')}
        >
          <Text
            className={cn(
              'text-sm font-semibold',
              isLight ? 'text-primary-foreground' : 'text-foreground'
            )}
          >
            ☀️ Light
          </Text>
        </Pressable>

        {/* Dark Option */}
        <Pressable
          className={cn(
            'flex-1 py-3 px-4 justify-center items-center',
            !isLight ? 'bg-primary' : 'bg-background'
          )}
          onPress={() => setThemeMode('dark')}
        >
          <Text
            className={cn(
              'text-sm font-semibold',
              !isLight ? 'text-primary-foreground' : 'text-foreground'
            )}
          >
            🌙 Dark
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
