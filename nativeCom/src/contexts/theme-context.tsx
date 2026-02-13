import { useColorScheme } from 'nativewind';
import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_STORAGE_KEY = '@kodo_theme_mode';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeModeContextType {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
}

export const ThemeModeContext = createContext<ThemeModeContextType>({
  themeMode: 'light',
  setThemeMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { setColorScheme } = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((savedMode) => {
      if (savedMode === 'light' || savedMode === 'dark' || savedMode === 'system') {
        setColorScheme(savedMode);
        setThemeModeState(savedMode);
      } else {
        setColorScheme('light');
      }
      setIsLoaded(true);
    });
  }, [setColorScheme]);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setColorScheme(mode);
    setThemeModeState(mode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
  }, [setColorScheme]);

  if (!isLoaded) return null;
  return (
    <ThemeModeContext.Provider value={{ themeMode, setThemeMode }}>
      {children}
    </ThemeModeContext.Provider>
  );
}
