import '@/global.css';

import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider, Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import Toast from 'react-native-toast-message';
import 'react-native-reanimated';

import { ThemeProvider } from '@/contexts/theme-context';
import { SocketProvider } from '@/contexts/socket-context';
import { DrawerProvider } from '@/contexts/drawer-context';
import { AppDrawer } from '@/components/navigation/app-drawer';
import { ExpoPushTokenManager } from '@/components/push/expo-push-token-manager';
import { useTheme } from '@/hooks/use-theme';
import { NAV_COLORS } from '@/lib/constants/nav-colors';

export { RouteErrorBoundary as ErrorBoundary } from '@/components/error/route-error-boundary';

export const unstable_settings = {
  anchor: '(tabs)',
};

const CustomLightTheme: Theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    ...NAV_COLORS.light,
  },
};

const CustomDarkTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    ...NAV_COLORS.dark,
  },
};

function RootNavigator() {
  const { colorScheme } = useTheme();

  return (
    <>
      <NavigationThemeProvider value={colorScheme === 'dark' ? CustomDarkTheme : CustomLightTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="community/create" options={{ headerShown: false }} />
          <Stack.Screen name="community/[communityId]" options={{ headerShown: false }} />
          <Stack.Screen name="checkout" options={{ headerShown: false }} />
          <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
        </Stack>
        <StatusBar style="auto" />
      </NavigationThemeProvider>
      <Toast />
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <SocketProvider>
        <DrawerProvider>
          <ExpoPushTokenManager />
          <RootNavigator />
          <AppDrawer />
        </DrawerProvider>
      </SocketProvider>
    </ThemeProvider>
  );
}
