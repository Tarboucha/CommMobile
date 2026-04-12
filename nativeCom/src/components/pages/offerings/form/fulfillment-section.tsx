import { View } from 'react-native';
import { FULFILLMENT_METHODS } from '@/types/offering';
import { OptionPicker } from './option-picker';
import type { OfferingFormState, OfferingFormAction } from './form-state';
import { setField } from './form-state';

interface Props {
  state: OfferingFormState;
  dispatch: (action: OfferingFormAction) => void;
}

export function FulfillmentSection({ state, dispatch }: Props) {
  return (
    <View className="mb-6">
      <OptionPicker
        label="Fulfillment Method"
        options={FULFILLMENT_METHODS}
        value={state.fulfillmentMethod}
        onChange={(value) => dispatch(setField('fulfillmentMethod', value))}
      />
    </View>
  );
}
