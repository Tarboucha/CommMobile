import { View } from 'react-native';
import { Stack } from 'expo-router';
import { Text } from '@/components/ui/text';

export default function CheckoutRoute() {
  return (
    <>
      <Stack.Screen options={{ title: 'Checkout' }} />
      <View className="flex-1 bg-background justify-center items-center p-6 gap-4">
        <View className="w-20 h-20 rounded-full justify-center items-center mb-2 bg-muted">
          <Text className="text-4xl">🧾</Text>
        </View>
        <Text className="text-2xl font-bold text-center">Checkout</Text>
        <Text className="text-base text-center text-muted-foreground">
          Booking checkout will be implemented here.
        </Text>
      </View>
    </>
  );
}
