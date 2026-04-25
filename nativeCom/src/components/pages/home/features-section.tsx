import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { MaterialCommunityIcons } from '@expo/vector-icons';

interface Feature {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  title: string;
  description: string;
  variant: 'light' | 'dark';
}

const features: Feature[] = [
  {
    icon: 'handshake-outline',
    title: 'Skill Exchange',
    description:
      'Trade gardening tips for bread baking. Learn from neighbors who already master what you want to learn.',
    variant: 'light',
  },
  {
    icon: 'archive-outline',
    title: 'Borrow & Lend',
    description:
      'Why buy when you can borrow? Access tools, equipment, and household goods within 500 meters.',
    variant: 'dark',
  },
  {
    icon: 'shield-lock-outline',
    title: 'Private to your community',
    description:
      'Closed groups where you join by invite or verified proximity. Only real neighbors.',
    variant: 'light',
  },
];

interface FeatureCardProps {
  feature: Feature;
}

function FeatureCard({ feature }: FeatureCardProps) {
  const isDark = feature.variant === 'dark';

  return (
    <View
      className={
        isDark
          ? 'bg-primary rounded-3xl p-6 gap-3'
          : 'bg-card rounded-3xl p-6 gap-3'
      }
      style={{
        shadowColor: '#4a352f',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isDark ? 0.15 : 0.08,
        shadowRadius: 16,
        elevation: 3,
      }}
    >
      <MaterialCommunityIcons
        name={feature.icon}
        size={32}
        color={isDark ? '#FAF7F2' : '#660000'}
      />
      <Text
        className="font-semibold text-[22px] leading-[28px]"
        style={{ color: isDark ? '#FAF7F2' : '#660000' }}
      >
        {feature.title}
      </Text>
      <Text
        className="font-sans text-[15px] leading-[24px]"
        style={{ color: isDark ? 'rgba(250, 247, 242, 0.85)' : '#78716C' }}
      >
        {feature.description}
      </Text>
    </View>
  );
}

export function FeaturesSection() {
  return (
    <View className="px-6 pt-4 pb-8 gap-4">
      {features.map((feature) => (
        <FeatureCard key={feature.title} feature={feature} />
      ))}
    </View>
  );
}
