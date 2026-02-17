import { Stack } from 'expo-router';

export default function CommunityLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="members" />
      <Stack.Screen name="invitation" />
      <Stack.Screen name="offerings" />
      <Stack.Screen name="posts" />
      <Stack.Screen name="cart" />
    </Stack>
  );
}
