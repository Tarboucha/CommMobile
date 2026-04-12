import { View, Pressable } from 'react-native';
import { Text } from '@/components/ui/text';

interface OptionPickerProps<T extends string> {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}

export function OptionPicker<T extends string>({
  label,
  options,
  value,
  onChange,
}: OptionPickerProps<T>) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-medium text-foreground">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => (
          <Pressable
            key={opt.value}
            className={`px-4 py-2 rounded-lg border ${
              value === opt.value
                ? 'bg-primary border-primary'
                : 'bg-card border-border'
            }`}
            onPress={() => onChange(opt.value)}
          >
            <Text
              className={`text-sm ${
                value === opt.value
                  ? 'text-primary-foreground font-semibold'
                  : 'text-foreground'
              }`}
            >
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
