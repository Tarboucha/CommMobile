import { View, Pressable } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';

export default function BookingSuccessRoute() {
  const { bookingIds, bookingNumbers } = useLocalSearchParams<{
    bookingIds?: string;
    bookingNumbers?: string;
  }>();

  const ids = bookingIds?.split(',').filter(Boolean) ?? [];
  const numbers = bookingNumbers?.split(',').filter(Boolean) ?? [];
  const count = numbers.length;

  return (
    <>
      <Stack.Screen options={{ title: 'Booking Confirmed', headerBackVisible: false }} />
      <View className="flex-1 bg-background justify-center items-center p-6 gap-5">
        <View className="w-20 h-20 rounded-full justify-center items-center bg-green-100">
          <Ionicons name="checkmark-circle" size={52} color="#10B981" />
        </View>

        <Text className="text-2xl font-bold text-center">
          {count > 1 ? `${count} Bookings Placed!` : 'Booking Placed!'}
        </Text>

        {/* Booking numbers — each tappable to go to detail */}
        {numbers.map((num, idx) => (
          <Pressable
            key={num}
            className="w-full px-5 py-3 rounded-lg bg-card border border-border flex-row items-center justify-between"
            onPress={() => {
              if (ids[idx]) {
                router.push({ pathname: '/booking/[bookingId]', params: { bookingId: ids[idx] } });
              }
            }}
          >
            <View>
              <Text className="text-sm text-muted-foreground">
                {count > 1 ? `Booking ${idx + 1}` : 'Booking Number'}
              </Text>
              <Text className="text-xl font-bold mt-1">{num}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </Pressable>
        ))}

        <Text className="text-base text-center text-muted-foreground">
          {count > 1
            ? 'Your bookings have been placed successfully. The providers will be notified.'
            : 'Your booking has been placed successfully. The provider will be notified.'}
        </Text>

        <Pressable
          className="mt-4 w-full py-4 rounded-xl items-center bg-primary"
          onPress={() => router.replace('/')}
        >
          <Text className="text-base font-semibold text-primary-foreground">Back to Home</Text>
        </Pressable>
      </View>
    </>
  );
}
