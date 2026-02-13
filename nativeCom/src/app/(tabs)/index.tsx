import { ScrollView, ActivityIndicator, View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { HeroSection } from '@/components/pages/home/hero-section';
import { FeaturesSection } from '@/components/pages/home/features-section';
import { DashboardSection } from '@/components/pages/home/dashboard-section';

export default function HomeScreen() {
  const { user, isLoading, isInitialized, initAuth } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) {
      initAuth();
    }
  }, [isInitialized, initAuth]);

  const handleNavigate = (path: string) => {
    router.push(path as Href);
  };

  if (isLoading || !isInitialized) {
    return (
      <View className="flex-1 bg-background justify-center items-center">
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (user) {
    return <DashboardSection user={user} />;
  }

  return (
    <ScrollView
      className="flex-1"
      contentContainerClassName="flex-grow"
      showsVerticalScrollIndicator={false}
    >
      <HeroSection onNavigate={handleNavigate} />
      <FeaturesSection onNavigate={handleNavigate} />
    </ScrollView>
  );
}
