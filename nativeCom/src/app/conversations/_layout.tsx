import { Stack } from 'expo-router';

export default function ConversationsLayout() {
  return (
    <Stack>
      <Stack.Screen name="[conversationId]" options={{ headerShown: false }} />
    </Stack>
  );
}
