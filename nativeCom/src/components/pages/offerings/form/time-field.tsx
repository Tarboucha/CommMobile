import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { TimePicker } from '@/components/ui/time-picker';

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
}

export function TimeField({ label, value, onChange }: TimeFieldProps) {
  const [showPicker, setShowPicker] = useState(false);

  return (
    <>
      <View className="gap-1 flex-1">
        <Text className="text-xs text-muted-foreground">{label}</Text>
        <Pressable
          className="border border-border rounded-lg px-4 py-3 bg-muted flex-row items-center justify-center gap-2"
          onPress={() => setShowPicker(true)}
        >
          <Ionicons name="time-outline" size={16} color="#78716C" />
          <Text className="text-sm font-semibold text-foreground">{value}</Text>
        </Pressable>
      </View>
      <TimePicker
        visible={showPicker}
        value={value}
        onChange={onChange}
        onClose={() => setShowPicker(false)}
        title={`Select ${label}`}
      />
    </>
  );
}
