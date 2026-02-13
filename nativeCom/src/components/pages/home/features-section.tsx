import { View } from 'react-native';
import { SectionContainer } from '@/components/shared/section-container';
import { FeatureCard } from '@/components/shared/feature-card';

interface Feature {
  icon: string;
  title: string;
  description: string;
  link: string | null;
}

const features: Feature[] = [
  {
    icon: '🏘️',
    title: 'Community',
    description: 'Join your neighbourhood community and connect with people nearby.',
    link: '/communities',
  },
  {
    icon: '🔍',
    title: 'Browse Offerings',
    description: 'Discover local offerings — food, products, services, sharing, and events.',
    link: '/communities',
  },
  {
    icon: '📋',
    title: 'Bookings',
    description: 'Book offerings, track your reservations, and manage everything in one place.',
    link: null,
  },
  {
    icon: '👤',
    title: 'Profiles',
    description: 'Manage your profile, addresses, and personal settings.',
    link: null,
  },
  {
    icon: '🛒',
    title: 'Cart & Checkout',
    description: 'Add offerings to your cart and check out with flexible payment options.',
    link: null,
  },
  {
    icon: '🔔',
    title: 'Notifications',
    description: 'Stay updated with booking changes, community news, and important updates.',
    link: null,
  },
  {
    icon: '📍',
    title: 'Addresses',
    description: 'Save and manage multiple addresses with location-based services.',
    link: null,
  },
  {
    icon: '📅',
    title: 'Availability',
    description: 'Providers set schedules, members pick time slots that work for them.',
    link: null,
  },
];

interface FeaturesSectionProps {
  onNavigate: (path: string) => void;
}

export function FeaturesSection({ onNavigate }: FeaturesSectionProps) {
  const rows: Feature[][] = [];
  for (let i = 0; i < features.length; i += 2) {
    rows.push(features.slice(i, i + 2));
  }

  return (
    <SectionContainer
      title="What KoDo Offers"
      subtitle="A community marketplace connecting neighbours and local providers">
      <View className="gap-4">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} className="flex-row gap-2">
            {row.map((feature, index) => (
              <FeatureCard
                key={`${rowIndex}-${index}`}
                icon={feature.icon}
                title={feature.title}
                description={feature.description}
                onPress={feature.link ? () => onNavigate(feature.link!) : undefined}
              />
            ))}
          </View>
        ))}
      </View>
    </SectionContainer>
  );
}
