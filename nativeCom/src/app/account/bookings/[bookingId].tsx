import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/text';

export default function BookingDetailsScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  return (
    <>
      <Stack.Screen options={{ title: 'Booking Details' }} />
      <View className="flex-1 bg-background justify-center items-center p-6 gap-4">
        <Text className="text-2xl font-bold text-center">Booking Details</Text>
        <Text className="text-base text-center text-muted-foreground">
          Booking #{bookingId} — details will be shown here once implemented.
        </Text>
      </View>
    </>
  );
}
