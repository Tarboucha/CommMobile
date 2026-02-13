import { View } from 'react-native';
import { router, Stack } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';

export default function CheckoutSuccessRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Booking Confirmed' }} />
      <View className="flex-1 bg-background justify-center items-center p-6 gap-4">
        <View className="w-20 h-20 rounded-full justify-center items-center mb-2 bg-green-100">
          <Text className="text-4xl">✅</Text>
        </View>
        <Text className="text-2xl font-bold text-center">Booking Confirmed!</Text>
        <Text className="text-base text-center text-muted-foreground">
          Your booking has been placed successfully.
        </Text>
        <Button className="mt-4" onPress={() => router.replace('/')}>
          <Text>Back to Home</Text>
        </Button>
      </View>
    </>
  );
}
