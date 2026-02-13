import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

interface HeroSectionProps {
  onNavigate: (path: string) => void;
}

export function HeroSection({ onNavigate }: HeroSectionProps) {
  return (
    <View className="py-10 px-4 items-center bg-burgundy">
      <View className="w-16 h-16 rounded-full bg-white/20 justify-center items-center mb-4">
        <Text className="text-3xl">🏘️</Text>
      </View>

      <Text className="text-2xl font-bold text-center mb-4 px-4 text-white">
        Your Neighbourhood, Your Marketplace
      </Text>

      <Text className="text-base text-center mb-6 max-w-[500px] px-4 text-white/80">
        Discover local offerings, connect with your community, and support the people around you.
      </Text>

      <View className="w-full max-w-[400px] gap-4 mb-4 px-4">
        <Button className="bg-white" onPress={() => onNavigate('/auth/sign-up')}>
          <Text className="text-burgundy font-semibold">Get Started</Text>
        </Button>
        <Button className="bg-rose" onPress={() => onNavigate('/auth/login')}>
          <Text className="text-white font-semibold">Login</Text>
        </Button>
      </View>

      <Text className="text-xs text-center text-white/70">
        Currently in <Text className="font-semibold text-white">Pre-Alpha</Text> · Features may change
      </Text>
    </View>
  );
}
