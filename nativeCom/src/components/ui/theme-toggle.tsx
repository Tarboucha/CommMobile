import { Pressable, Text, View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function ThemeToggle() {
  const { themeMode, setThemeMode } = useTheme();

  const modes: Array<{ mode: 'light' | 'dark' | 'system'; icon: string; label: string }> = [
    { mode: 'light', icon: '☀️', label: 'Light' },
    { mode: 'dark', icon: '🌙', label: 'Dark' },
    { mode: 'system', icon: '⚙️', label: 'System' },
  ];

  return (
    <View className="flex-row gap-2 justify-center">
      {modes.map(({ mode, icon, label }) => {
        const isActive = themeMode === mode;
        return (
          <Pressable
            key={mode}
            className={`items-center min-w-[80px] rounded-md border py-2 px-4 ${
              isActive
                ? 'bg-primary border-primary'
                : 'bg-muted border-border'
            }`}
            onPress={() => setThemeMode(mode)}>
            <Text
              className={`text-2xl mb-1 ${
                isActive ? 'text-primary-foreground' : 'text-foreground'
              }`}>
              {icon}
            </Text>
            <Text
              className={`text-xs font-medium ${
                isActive ? 'text-primary-foreground' : 'text-foreground'
              }`}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
