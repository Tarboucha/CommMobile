import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';
import type { TransactionType } from '@/types/offering';
import type { OfferingFormState, OfferingFormAction } from './form-state';
import { setField } from './form-state';

const PRODUCT_TRANSACTION_TYPES: { value: TransactionType; label: string; description: string }[] = [
  { value: 'purchase', label: 'Sell', description: 'Customer keeps the item' },
  { value: 'loan', label: 'Loan', description: 'Customer borrows and returns it' },
];

interface Props {
  state: OfferingFormState;
  dispatch: (action: OfferingFormAction) => void;
}

export function TransactionTypeSection({ state, dispatch }: Props) {
  // Only show for products
  if (state.category !== 'product') return null;

  return (
    <View className="mb-6 gap-2">
      <Text className="text-sm font-medium text-foreground">What are you doing with it? *</Text>
      <View className="flex-row gap-2">
        {PRODUCT_TRANSACTION_TYPES.map((opt) => (
          <Pressable
            key={opt.value}
            className={`flex-1 p-4 rounded-xl border-2 ${
              state.transactionType === opt.value
                ? 'bg-primary/10 border-primary'
                : 'bg-card border-border'
            }`}
            onPress={() => dispatch(setField('transactionType', opt.value))}
          >
            <Text
              className={`text-sm font-semibold ${
                state.transactionType === opt.value ? 'text-primary' : 'text-foreground'
              }`}
            >
              {opt.label}
            </Text>
            <Text className="text-xs text-muted-foreground mt-0.5">{opt.description}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
