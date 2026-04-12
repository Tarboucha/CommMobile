import { View, TextInput, Switch } from 'react-native';
import { Text } from '@/components/ui/text';
import type { OfferingFormState, OfferingFormAction } from './form-state';
import { isLoanOffering, setField } from './form-state';

interface Props {
  state: OfferingFormState;
  dispatch: (action: OfferingFormAction) => void;
}

export function DepositSection({ state, dispatch }: Props) {
  // Only show for loans
  if (!isLoanOffering(state)) return null;

  return (
    <View className="gap-4 mb-6">
      <Text className="text-lg font-bold text-foreground">Security Deposit</Text>
      <View className="flex-row items-center justify-between p-4 rounded-xl border border-border bg-card">
        <View className="flex-1 mr-3">
          <Text className="text-sm font-semibold text-foreground">Requires deposit</Text>
          <Text className="text-xs text-muted-foreground">
            Refundable amount held as security
          </Text>
        </View>
        <Switch
          value={state.requiresDeposit}
          onValueChange={(v) => dispatch(setField('requiresDeposit', v))}
          trackColor={{ false: '#D6D3D1', true: '#660000' }}
          thumbColor="#FFFFFF"
        />
      </View>
      {state.requiresDeposit && (
        <View className="gap-1">
          <Text className="text-sm font-medium text-foreground">Deposit amount (EUR) *</Text>
          <TextInput
            className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card"
            placeholder="50.00"
            placeholderTextColor="#78716C"
            value={state.depositAmount}
            onChangeText={(v) => dispatch(setField('depositAmount', v))}
            keyboardType="decimal-pad"
          />
        </View>
      )}
    </View>
  );
}
