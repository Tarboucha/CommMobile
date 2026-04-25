import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';

interface HeroSectionProps {
  onNavigate: (path: string) => void;
}

export function HeroSection({ onNavigate }: HeroSectionProps) {
  return (
    <View className="bg-background px-6 pt-16 pb-8 gap-3">
      <Text className="font-bold text-[36px] leading-[40px] tracking-tight text-primary">
        Belong to your neighborhood.
      </Text>

      <Text className="font-sans text-[17px] leading-[26px] text-muted-foreground pt-1">
        Share goods, services, and skills with the people right outside your door.
      </Text>

      <View className="gap-3 pt-6">
        <Pressable
          onPress={() => onNavigate('/auth/sign-up')}
          className="bg-primary rounded-2xl h-14 items-center justify-center active:opacity-90"
          style={{
            shadowColor: '#4a352f',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.12,
            shadowRadius: 20,
            elevation: 4,
          }}
        >
          <Text className="font-semibold text-[17px] text-primary-foreground">
            Get Started
          </Text>
        </Pressable>

        <Pressable
          onPress={() => onNavigate('/auth/login')}
          className="h-10 items-center justify-center"
        >
          <Text className="font-semibold text-[15px] text-primary">
            Already a member?  <Text className="underline">Log in</Text>
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
