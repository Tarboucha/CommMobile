import { useColorScheme } from 'nativewind';
import { useContext } from 'react';
import { ThemeModeContext } from '@/contexts/theme-context';

export function useTheme() {
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const { themeMode, setThemeMode } = useContext(ThemeModeContext);

  return {
    colorScheme: colorScheme ?? 'light',
    themeMode,
    setThemeMode,
    toggleColorScheme,
  };
}
