import { View } from 'react-native';
import { OFFERING_CATEGORIES } from '@/types/offering';
import { OptionPicker } from './option-picker';
import type { OfferingFormState, OfferingFormAction } from './form-state';

interface Props {
  state: OfferingFormState;
  dispatch: (action: OfferingFormAction) => void;
}

export function CategorySection({ state, dispatch }: Props) {
  return (
    <View className="mb-6">
      <OptionPicker
        label="Category *"
        options={OFFERING_CATEGORIES}
        value={state.category}
        onChange={(value) => dispatch({ type: 'CHANGE_CATEGORY', value })}
      />
    </View>
  );
}
