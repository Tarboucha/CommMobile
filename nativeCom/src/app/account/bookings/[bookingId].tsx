import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

/**
 * Redirect to the real booking detail screen at /booking/[bookingId].
 */
export default function BookingDetailRedirect() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();

  useEffect(() => {
    if (bookingId) {
      router.replace({
        pathname: '/booking/[bookingId]',
        params: { bookingId },
      });
    }
  }, [bookingId]);

  return (
    <View className="flex-1 bg-background justify-center items-center">
      <ActivityIndicator size="large" />
    </View>
  );
}
