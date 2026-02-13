import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useCartStore } from '@/lib/stores/cart-store';

interface CartTabIconProps {
  color: string;
  focused: boolean;
}

export function CartTabIcon({ color }: CartTabIconProps) {
  const itemCount = useCartStore((state) =>
    state.items.reduce((count, item) => count + item.quantity, 0)
  );

  return (
    <View className="relative w-7 h-7">
      <IconSymbol size={28} name="cart.fill" color={color} />
      {itemCount > 0 && (
        <View className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] rounded-full justify-center items-center px-1 bg-primary">
          <Text className="text-[11px] font-semibold text-primary-foreground">
            {itemCount > 99 ? '99+' : itemCount}
          </Text>
        </View>
      )}
    </View>
  );
}
