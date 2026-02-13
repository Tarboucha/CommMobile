import { Tabs } from 'expo-router';
import React from 'react';
import { Image } from 'react-native';

import { HapticTab } from '@/components/ui/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { HamburgerButton } from '@/components/navigation/hamburger-button';
import { NotificationBellButton } from '@/components/navigation/notification-bell-button';
import { NAV_COLORS } from '@/lib/constants/nav-colors';
import { useTheme } from '@/hooks/use-theme';

function HeaderLogo() {
  return (
    <Image
      source={require('@/assets/images/icon.png')}
      className="w-[120px] h-10"
      resizeMode="contain"
    />
  );
}

export default function TabLayout() {
  const { colorScheme } = useTheme();

  const colors = NAV_COLORS[colorScheme];

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
        },
        headerShown: true,
        headerTitle: () => <HeaderLogo />,
        headerTitleAlign: 'center',
        headerStyle: { backgroundColor: colors.card },
        headerShadowVisible: false,
        headerLeft: () => <HamburgerButton />,
        headerRight: () => <NotificationBellButton />,
        tabBarButton: HapticTab,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="house.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: 'Communities',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="person.3.fill" color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarIcon: ({ color }) => <IconSymbol size={28} name="calendar" color={color} />,
        }}
      />
      <Tabs.Screen
        name="conversations"
        options={{
          title: 'Chats',
          tabBarIcon: ({ color }) => (
            <IconSymbol size={28} name="bubble.left.and.bubble.right.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
