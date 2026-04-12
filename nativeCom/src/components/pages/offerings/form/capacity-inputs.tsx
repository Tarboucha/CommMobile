import { View, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';

interface CapacityInputsProps {
  slotsAvailable: string;
  slotLabel: string;
  onSlotsChange: (v: string) => void;
  onLabelChange: (v: string) => void;
}

export function CapacityInputs({
  slotsAvailable,
  slotLabel,
  onSlotsChange,
  onLabelChange,
}: CapacityInputsProps) {
  return (
    <View className="gap-3">
      <View className="gap-1">
        <Text className="text-xs text-muted-foreground">Slots Available *</Text>
        <View className="flex-row items-center gap-2">
          <Pressable
            className="w-10 h-10 rounded-lg border border-border bg-muted justify-center items-center"
            onPress={() => {
              const v = parseInt(slotsAvailable) || 0;
              if (v > 1) onSlotsChange(String(v - 1));
            }}
          >
            <Ionicons name="remove" size={18} color="#78716C" />
          </Pressable>
          <TextInput
            className="flex-1 border border-border rounded-lg px-4 py-2.5 text-sm text-foreground bg-muted text-center font-semibold"
            value={slotsAvailable}
            onChangeText={onSlotsChange}
            keyboardType="number-pad"
          />
          <Pressable
            className="w-10 h-10 rounded-lg border border-border bg-muted justify-center items-center"
            onPress={() => {
              const v = parseInt(slotsAvailable) || 0;
              onSlotsChange(String(v + 1));
            }}
          >
            <Ionicons name="add" size={18} color="#78716C" />
          </Pressable>
        </View>
      </View>

      <View className="gap-1">
        <Text className="text-xs text-muted-foreground">Slot Label (optional)</Text>
        <TextInput
          className="border border-border rounded-lg px-4 py-3 text-sm text-foreground bg-muted"
          placeholder="e.g. seats, servings, spots"
          placeholderTextColor="#78716C"
          value={slotLabel}
          onChangeText={onLabelChange}
          maxLength={100}
        />
      </View>
    </View>
  );
}
