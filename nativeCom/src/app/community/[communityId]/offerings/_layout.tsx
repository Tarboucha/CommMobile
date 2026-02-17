import { Stack } from 'expo-router';

export default function OfferingsLayout() {
  return (
    <Stack>
      <Stack.Screen name="new" options={{ headerShown: false }} />
      <Stack.Screen name="[offeringId]/index" options={{ headerShown: false }} />
    </Stack>
  );
}
