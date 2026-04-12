import { View, TextInput } from 'react-native';
import { Text } from '@/components/ui/text';
import type { OfferingFormState, OfferingFormAction } from './form-state';
import { setField } from './form-state';

interface Props {
  state: OfferingFormState;
  dispatch: (action: OfferingFormAction) => void;
}

export function BasicInfoSection({ state, dispatch }: Props) {
  return (
    <View className="gap-4 mb-6">
      <Text className="text-lg font-bold text-foreground">Basic Info</Text>

      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">Title *</Text>
        <TextInput
          className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card"
          placeholder="What are you offering?"
          placeholderTextColor="#78716C"
          value={state.title}
          onChangeText={(v) => dispatch(setField('title', v))}
          maxLength={200}
        />
      </View>

      <View className="gap-1">
        <Text className="text-sm font-medium text-foreground">Description</Text>
        <TextInput
          className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-card min-h-[100px]"
          placeholder="Describe your offering..."
          placeholderTextColor="#78716C"
          value={state.description}
          onChangeText={(v) => dispatch(setField('description', v))}
          multiline
          textAlignVertical="top"
          maxLength={2000}
        />
      </View>
    </View>
  );
}
