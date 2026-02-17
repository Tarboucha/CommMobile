import { Stack } from 'expo-router';

export default function PostsLayout() {
  return (
    <Stack>
      <Stack.Screen name="new" options={{ headerShown: false }} />
    </Stack>
  );
}
