import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import type { FulfillmentMethodSelectorProps } from '@/types/checkout';

/**
 * FulfillmentMethodSelector - Reusable fulfillment method selector
 * Displays delivery and pickup options with fee information
 */
export function FulfillmentMethodSelector({
  deliveryEnabled,
  pickupEnabled,
  selectedMethod,
  onSelect,
  deliveryFee = 0,
  freeDeliveryThreshold,
  subtotal = 0,
  currencyCode = 'EUR',
}: FulfillmentMethodSelectorProps) {
  const isFreeDelivery = freeDeliveryThreshold && subtotal >= freeDeliveryThreshold;

  return (
    <View className="gap-4 bg-transparent">
      <Text className="text-lg font-semibold">Fulfillment Method</Text>

      <View className="gap-4">
        {/* Delivery Option */}
        {deliveryEnabled && (
          <Pressable
            className={`flex-row p-4 rounded-lg border-2 ${selectedMethod === 'delivery' ? 'border-primary bg-secondary' : 'border-border bg-card'}`}
            onPress={() => onSelect('delivery')}
          >
            <View className="mr-3">
              <View
                className={`w-6 h-6 rounded-full border-2 items-center justify-center ${selectedMethod === 'delivery' ? 'border-primary' : 'border-border'}`}
              >
                {selectedMethod === 'delivery' && (
                  <View className="w-3 h-3 rounded-full bg-primary" />
                )}
              </View>
            </View>

            <View className="flex-1 gap-1">
              <View className="flex-row items-center">
                <Ionicons
                  name="car-outline"
                  size={20}
                  color="#1F2937"
                  style={{ marginRight: 4 }}
                />
                <Text className="text-base font-semibold">Delivery</Text>
              </View>

              <View className="gap-1">
                {isFreeDelivery ? (
                  <View className="flex-row items-center flex-wrap gap-1">
                    <View className="px-3 py-0.5 rounded bg-green-500/20">
                      <Text className="text-xs font-semibold text-green-600">
                        Free Delivery
                      </Text>
                    </View>
                    <Text className="text-sm opacity-70">
                      Order over {freeDeliveryThreshold?.toFixed(2)} {currencyCode}
                    </Text>
                  </View>
                ) : (
                  <Text className="text-sm opacity-70">
                    {deliveryFee > 0
                      ? `Delivery fee: ${deliveryFee.toFixed(2)} ${currencyCode}`
                      : 'No delivery fee'}
                  </Text>
                )}
                {freeDeliveryThreshold && !isFreeDelivery && (
                  <Text className="text-xs opacity-60">
                    Add {(freeDeliveryThreshold - subtotal).toFixed(2)}{' '}
                    {currencyCode} more for free delivery
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        )}

        {/* Pickup Option */}
        {pickupEnabled && (
          <Pressable
            className={`flex-row p-4 rounded-lg border-2 ${selectedMethod === 'pickup' ? 'border-primary bg-secondary' : 'border-border bg-card'}`}
            onPress={() => onSelect('pickup')}
          >
            <View className="mr-3">
              <View
                className={`w-6 h-6 rounded-full border-2 items-center justify-center ${selectedMethod === 'pickup' ? 'border-primary' : 'border-border'}`}
              >
                {selectedMethod === 'pickup' && (
                  <View className="w-3 h-3 rounded-full bg-primary" />
                )}
              </View>
            </View>

            <View className="flex-1 gap-1">
              <View className="flex-row items-center">
                <Ionicons
                  name="storefront-outline"
                  size={20}
                  color="#1F2937"
                  style={{ marginRight: 4 }}
                />
                <Text className="text-base font-semibold">Pickup</Text>
              </View>

              <Text className="text-sm opacity-70">
                Pick up your order at the restaurant
              </Text>
            </View>
          </Pressable>
        )}

        {/* No options available */}
        {!deliveryEnabled && !pickupEnabled && (
          <Text className="text-sm opacity-70 text-center p-4">
            No fulfillment methods available
          </Text>
        )}
      </View>
    </View>
  );
}
