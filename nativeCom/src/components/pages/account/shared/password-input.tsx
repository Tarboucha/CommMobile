import { useState } from 'react';
import { View, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';

interface PasswordInputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  hint?: string;
}

export function PasswordInput({
  label,
  value,
  onChangeText,
  placeholder = 'Enter password',
  error,
  hint,
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <View className="mb-4">
      <Text className="text-sm font-semibold mb-1">{label}</Text>

      <View
        className={`flex-row items-center border rounded-lg px-4 bg-card ${error ? 'border-destructive' : 'border-input'}`}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          className="flex-1 h-12 text-base text-foreground"
        />

        <TouchableOpacity
          onPress={() => setShowPassword(!showPassword)}
          className="p-1 ml-1"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color="#6B7280"
          />
        </TouchableOpacity>
      </View>

      {error && (
        <Text className="text-xs mt-0.5 text-destructive">
          {error}
        </Text>
      )}

      {hint && !error && (
        <Text className="text-xs mt-0.5 text-muted-foreground">
          {hint}
        </Text>
      )}
    </View>
  );
}
