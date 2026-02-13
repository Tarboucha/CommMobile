import { useEffect } from 'react';
import { View, Pressable, ScrollView, Alert, Dimensions, Image } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { ThemeSwitcher } from '@/components/pages/account/shared/theme-switcher';
import { useDrawer } from '@/contexts/drawer-context';
import { useAuthStore } from '@/lib/stores/auth-store';
import { supabase } from '@/lib/supabase/client';
import { getPublicUrl } from '@/lib/utils/storage';

const SCREEN_WIDTH = Dimensions.get('window').width;
const DRAWER_WIDTH = SCREEN_WIDTH * 0.8;

interface DrawerMenuItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  variant?: 'default' | 'destructive';
}

function DrawerMenuItem({ icon, label, onPress, variant = 'default' }: DrawerMenuItemProps) {
  const isDestructive = variant === 'destructive';

  return (
    <Pressable
      className="flex-row items-center px-5 py-4 active:bg-muted/50"
      onPress={onPress}
    >
      <Ionicons
        name={icon}
        size={22}
        color={isDestructive ? '#DC2626' : '#78716C'}
        style={{ marginRight: 14 }}
      />
      <Text
        className={
          isDestructive
            ? 'text-base font-medium text-destructive'
            : 'text-base font-medium text-foreground'
        }
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function AppDrawer() {
  const { isOpen, closeDrawer } = useDrawer();
  const { user } = useAuthStore();

  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(isOpen ? 1 : 0, { duration: 250 });
  }, [isOpen, progress]);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 1], [0, 0.5]),
    pointerEvents: isOpen ? ('auto' as const) : ('none' as const),
  }));

  const drawerStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: interpolate(progress.value, [0, 1], [-DRAWER_WIDTH, 0]),
      },
    ],
  }));

  const navigateTo = (path: string) => {
    closeDrawer();
    setTimeout(() => router.push(path as Href), 100);
  };

  const handleLogout = () => {
    closeDrawer();
    setTimeout(() => {
      Alert.alert('Log Out', 'Are you sure you want to log out?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Out',
          style: 'destructive',
          onPress: async () => {
            await supabase.auth.signOut();
            router.replace('/');
          },
        },
      ]);
    }, 100);
  };

  const avatarUrl = user ? getPublicUrl(user.avatar_url) : null;

  const getInitials = () => {
    if (!user) return '?';
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.first_name) return user.first_name[0].toUpperCase();
    return (user.email ?? '?')[0].toUpperCase();
  };

  const getDisplayName = () => {
    if (!user) return '';
    if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
    if (user.first_name) return user.first_name;
    return 'My Profile';
  };

  return (
    <View className="absolute inset-0 z-50" pointerEvents={isOpen ? 'auto' : 'none'}>
      {/* Backdrop */}
      <Animated.View
        style={[{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#000' }, backdropStyle]}
      >
        <Pressable className="flex-1" onPress={closeDrawer} />
      </Animated.View>

      {/* Drawer Panel */}
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: DRAWER_WIDTH,
          },
          drawerStyle,
        ]}
        className="bg-card"
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="pb-8"
          showsVerticalScrollIndicator={false}
        >
          {/* Profile Header */}
          {user ? (
            <Pressable
              className="px-5 pt-16 pb-6 border-b border-border active:bg-muted/50"
              onPress={() => navigateTo('/account/profile')}
            >
              <View className="flex-row items-center">
                <View className="w-14 h-14 rounded-full justify-center items-center mr-4 overflow-hidden bg-primary">
                  {avatarUrl ? (
                    <Image source={{ uri: avatarUrl }} className="w-14 h-14" />
                  ) : (
                    <Text className="text-xl font-semibold text-primary-foreground">
                      {getInitials()}
                    </Text>
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-lg font-semibold">{getDisplayName()}</Text>
                  <Text className="text-sm text-muted-foreground">{user.email ?? ''}</Text>
                </View>
              </View>
            </Pressable>
          ) : (
            <View className="px-5 pt-16 pb-6 border-b border-border">
              <Text className="text-lg font-semibold mb-4">Welcome to KoDo</Text>
              <Pressable
                className="py-3 rounded-lg mb-2 bg-primary active:bg-primary/90"
                onPress={() => navigateTo('/auth/login')}
              >
                <Text className="text-base font-semibold text-center text-primary-foreground">
                  Log In
                </Text>
              </Pressable>
              <Pressable
                className="py-3 rounded-lg border border-border active:bg-muted"
                onPress={() => navigateTo('/auth/sign-up')}
              >
                <Text className="text-base font-semibold text-center text-foreground">
                  Create Account
                </Text>
              </Pressable>
            </View>
          )}

          {/* Menu Items */}
          {user && (
            <>
              <View className="pt-2">
                <DrawerMenuItem
                  icon="person-outline"
                  label="My Profile"
                  onPress={() => navigateTo('/account/profile')}
                />
                <DrawerMenuItem
                  icon="receipt-outline"
                  label="My Bookings"
                  onPress={() => navigateTo('/account/bookings')}
                />
                <DrawerMenuItem
                  icon="heart-outline"
                  label="Saved Offers"
                  onPress={() => navigateTo('/account/saved')}
                />
                <DrawerMenuItem
                  icon="location-outline"
                  label="My Addresses"
                  onPress={() => navigateTo('/account/addresses')}
                />
                <DrawerMenuItem
                  icon="notifications-outline"
                  label="Notifications"
                  onPress={() => navigateTo('/notifications')}
                />
                <DrawerMenuItem
                  icon="lock-closed-outline"
                  label="Change Password"
                  onPress={() => navigateTo('/account/settings/password')}
                />
              </View>

              {/* Theme */}
              <View className="px-5 pt-4 pb-2 border-t border-border mt-2">
                <Text className="text-xs font-semibold uppercase tracking-wide mb-2 text-muted-foreground">
                  Appearance
                </Text>
                <ThemeSwitcher />
              </View>

              {/* Logout */}
              <View className="border-t border-border mt-2">
                <DrawerMenuItem
                  icon="log-out-outline"
                  label="Log Out"
                  onPress={handleLogout}
                  variant="destructive"
                />
              </View>
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
