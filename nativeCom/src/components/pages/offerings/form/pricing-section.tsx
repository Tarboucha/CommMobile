import { View, TextInput } from 'react-native';
import { Text } from '@/components/ui/text';
import type { OfferingFormState, OfferingFormAction } from './form-state';
import { isLoanOffering, setField } from './form-state';

interface Props {
  state: OfferingFormState;
  dispatch: (action: OfferingFormAction) => void;
}

export function PricingSection({ state, dispatch }: Props) {
  const isLoan = isLoanOffering(state);

  return (
    <View className="gap-4 mb-6">
      <Text className="text-lg font-bold text-foreground">
        {isLoan ? 'Rental Fee' : 'Price'}
      </Text>
      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">
          {isLoan ? 'Rental fee (EUR)' : 'Price (EUR)'}
        </Text>
        <TextInput
          className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card"
          placeholder={isLoan ? '0.00 (leave empty for free loan)' : '0.00 (leave empty for free)'}
          placeholderTextColor="#78716C"
          value={state.priceAmount}
          onChangeText={(v) => dispatch(setField('priceAmount', v))}
          keyboardType="decimal-pad"
        />
        <Text className="text-xs text-muted-foreground">
          Leave empty for a free {isLoan ? 'loan' : 'offering'}.
        </Text>
      </View>
    </View>
  );
}
