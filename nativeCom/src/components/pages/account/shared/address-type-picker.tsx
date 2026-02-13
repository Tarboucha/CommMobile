import { View, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { getAddressTypeIcon, getAddressTypeLabel } from '@/lib/utils/address-ui-helpers';

interface AddressTypePickerProps {
  value: 'home' | 'work' | 'other';
  onChange: (value: 'home' | 'work' | 'other') => void;
}

export function AddressTypePicker({ value, onChange }: AddressTypePickerProps) {
  const types: Array<'home' | 'work' | 'other'> = ['home', 'work', 'other'];

  return (
    <View className="flex-row gap-3">
      {types.map((type) => {
        const isSelected = value === type;
        const iconName = getAddressTypeIcon(type);
        const label = getAddressTypeLabel(type);

        return (
          <TouchableOpacity
            key={type}
            className={`flex-1 flex-row items-center justify-center gap-1 py-4 px-3 rounded-lg border ${isSelected ? 'bg-primary border-primary' : 'bg-muted border-border'}`}
            onPress={() => onChange(type)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={iconName as keyof typeof Ionicons.glyphMap}
              size={20}
              color={isSelected ? '#FFFFFF' : '#1F2937'}
            />
            <Text
              className={`text-sm font-semibold ${isSelected ? 'text-primary-foreground' : 'text-foreground'}`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}
