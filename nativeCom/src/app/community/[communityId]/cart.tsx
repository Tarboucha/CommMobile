import { View, FlatList, Pressable, Image, Alert } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useCartStore, type BookingCartItem } from '@/lib/stores/cart-store';

function formatPrice(amount: number, currency: string): string {
  if (amount === 0) return 'Free';
  return `${amount.toFixed(2)} ${currency}`;
}

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  product: 'cube-outline',
  service: 'construct-outline',
  event: 'calendar-outline',
  share: 'share-outline',
};

function CartItemRow({ item }: { item: BookingCartItem }) {
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const lineTotal = item.priceAmount * item.quantity;

  return (
    <View className="flex-row bg-card rounded-xl border border-border p-3 mx-4 mb-3">
      {/* Image or category icon */}
      {item.imageUrl ? (
        <Image
          source={{ uri: item.imageUrl }}
          className="w-16 h-16 rounded-lg"
          resizeMode="cover"
        />
      ) : (
        <View className="w-16 h-16 rounded-lg items-center justify-center bg-muted">
          <Ionicons
            name={CATEGORY_ICONS[item.offeringCategory] ?? 'pricetag-outline'}
            size={24}
            color="#78716C"
          />
        </View>
      )}

      {/* Info */}
      <View className="flex-1 ml-3 justify-between">
        <View>
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>
            {item.offeringTitle}
          </Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>
            by {item.providerName}
          </Text>
        </View>

        <View className="flex-row items-center justify-between mt-2">
          {/* Quantity controls */}
          <View className="flex-row items-center gap-2">
            <Pressable
              onPress={() => updateQuantity(item.cartItemKey, item.quantity - 1)}
              className="w-7 h-7 rounded-full border border-border items-center justify-center active:bg-muted"
            >
              <Ionicons name="remove" size={14} color="#78716C" />
            </Pressable>
            <Text className="text-sm font-semibold w-6 text-center">{item.quantity}</Text>
            <Pressable
              onPress={() => updateQuantity(item.cartItemKey, item.quantity + 1)}
              className="w-7 h-7 rounded-full border border-border items-center justify-center active:bg-muted"
            >
              <Ionicons name="add" size={14} color="#78716C" />
            </Pressable>
          </View>

          {/* Line total */}
          <Text className="text-sm font-bold text-primary">
            {formatPrice(lineTotal, item.currencyCode)}
          </Text>
        </View>
      </View>

      {/* Remove button */}
      <Pressable
        onPress={() => removeItem(item.cartItemKey)}
        className="ml-2 p-1 self-start"
      >
        <Ionicons name="close-circle" size={20} color="#DC2626" />
      </Pressable>
    </View>
  );
}

export default function CartScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const router = useRouter();

  const items = useCartStore((s) => s.items);
  const clearCart = useCartStore((s) => s.clearCart);
  const getTotalAmount = useCartStore((s) => s.getTotalAmount);
  const getItemCount = useCartStore((s) => s.getItemCount);

  const totalAmount = getTotalAmount();
  const itemCount = getItemCount();
  const currency = items[0]?.currencyCode ?? 'EUR';

  function handleClearCart() {
    Alert.alert('Clear Cart', 'Remove all items from your cart?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearCart },
    ]);
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'Cart',
          headerRight: () =>
            items.length > 0 ? (
              <Pressable onPress={handleClearCart} className="mr-2">
                <Text className="text-sm text-destructive font-medium">Clear All</Text>
              </Pressable>
            ) : null,
        }}
      />
      <View className="flex-1 bg-background">
        {items.length === 0 ? (
          <View className="flex-1 justify-center items-center p-6 gap-4">
            <Ionicons name="cart-outline" size={64} color="#A1A1AA" />
            <Text className="text-lg font-semibold text-muted-foreground">
              Your cart is empty
            </Text>
            <Pressable
              onPress={() => router.back()}
              className="px-6 py-3 rounded-lg bg-primary active:opacity-80"
            >
              <Text className="text-sm font-semibold text-primary-foreground">
                Browse Offerings
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <FlatList
              data={items}
              keyExtractor={(item) => item.cartItemKey}
              renderItem={({ item }) => <CartItemRow item={item} />}
              contentContainerClassName="pt-4 pb-40"
              showsVerticalScrollIndicator={false}
            />

            {/* Footer */}
            <View className="absolute bottom-0 left-0 right-0 bg-card border-t border-border px-4 pt-4 pb-8">
              <View className="flex-row justify-between items-center mb-3">
                <Text className="text-sm text-muted-foreground">
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                </Text>
                <Text className="text-lg font-bold text-foreground">
                  {formatPrice(totalAmount, currency)}
                </Text>
              </View>
              <Pressable
                onPress={() => router.push('/booking')}
                className="w-full py-3.5 rounded-xl bg-primary items-center active:opacity-80"
              >
                <Text className="text-base font-semibold text-primary-foreground">
                  Review Booking
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </>
  );
}
