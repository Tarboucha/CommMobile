import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import type { PaymentMethodSelectorProps } from '@/types/checkout';

/**
 * PaymentMethodSelector - Reusable payment method selector
 * Displays payment options based on fulfillment method and chef settings
 */
export function PaymentMethodSelector({
  fulfillmentMethod,
  selectedMethod,
  onSelect,
  acceptsOnlinePayment,
  cashOnDeliveryEnabled,
  cashOnPickupEnabled,
}: PaymentMethodSelectorProps) {
  const showCardOption = acceptsOnlinePayment;
  const showCashOption =
    fulfillmentMethod === 'delivery'
      ? cashOnDeliveryEnabled
      : fulfillmentMethod === 'pickup'
      ? cashOnPickupEnabled
      : false;

  const hasAnyOption = showCardOption || showCashOption;

  return (
    <View className="gap-4 bg-transparent">
      <Text className="text-lg font-semibold">Payment Method</Text>

      <View className="gap-4">
        {/* Card Payment (Coming Soon) */}
        {showCardOption && (
          <View className="flex-row p-4 rounded-lg border-2 border-border bg-card opacity-60">
            <View className="mr-3">
              <View className="w-6 h-6 rounded-full border-2 border-border items-center justify-center opacity-50" />
            </View>

            <View className="flex-1 gap-1">
              <View className="flex-row items-center flex-wrap gap-1">
                <Ionicons
                  name="card-outline"
                  size={20}
                  color="#6B7280"
                  style={{ marginRight: 2 }}
                />
                <Text className="text-base font-semibold opacity-70">
                  Card (Online Payment)
                </Text>
                <View className="px-3 py-0.5 rounded bg-muted-foreground/20">
                  <Text className="text-xs font-semibold text-muted-foreground">
                    Coming Soon
                  </Text>
                </View>
              </View>

              <Text className="text-sm opacity-70">
                Online payment processing will be available soon
              </Text>
            </View>
          </View>
        )}

        {/* Cash Payment */}
        {showCashOption && (
          <Pressable
            className={`flex-row p-4 rounded-lg border-2 ${selectedMethod === 'cash' ? 'border-primary bg-secondary' : 'border-border bg-card'}`}
            onPress={() => onSelect('cash')}
          >
            <View className="mr-3">
              <View
                className={`w-6 h-6 rounded-full border-2 items-center justify-center ${selectedMethod === 'cash' ? 'border-primary' : 'border-border'}`}
              >
                {selectedMethod === 'cash' && (
                  <View className="w-3 h-3 rounded-full bg-primary" />
                )}
              </View>
            </View>

            <View className="flex-1 gap-1">
              <View className="flex-row items-center">
                <Ionicons
                  name="cash-outline"
                  size={20}
                  color="#1F2937"
                  style={{ marginRight: 4 }}
                />
                <Text className="text-base font-semibold">
                  {fulfillmentMethod === 'delivery'
                    ? 'Cash on Delivery'
                    : 'Cash on Pickup'}
                </Text>
              </View>

              <Text className="text-sm opacity-70">
                {fulfillmentMethod === 'delivery'
                  ? 'Pay with cash when you receive your order'
                  : 'Pay with cash when you pick up your order'}
              </Text>
            </View>
          </Pressable>
        )}

        {/* No payment methods available */}
        {!hasAnyOption && (
          <Text className="text-sm opacity-70 text-center p-4">
            No payment methods available for this fulfillment method.
          </Text>
        )}
      </View>
    </View>
  );
}
