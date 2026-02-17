import { Stack } from 'expo-router';

export default function BookingLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'Review Booking' }} />
      <Stack.Screen name="success/index" options={{ title: 'Booking Confirmed', headerBackVisible: false }} />
      <Stack.Screen name="[bookingId]/index" options={{ title: 'Booking Details' }} />
      <Stack.Screen name="[bookingId]/chat" options={{ title: 'Booking Chat' }} />
    </Stack>
  );
}
