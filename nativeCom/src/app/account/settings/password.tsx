import { useState } from 'react';
import {
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Text } from '@/components/ui/text';
import { PasswordInput } from '@/components/pages/account/shared/password-input';
import { resetPasswordSchema } from '@/lib/validations/auth';

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL || 'http://localhost:3004';

export default function PasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    password?: string;
    confirmPassword?: string;
  }>({});
  const [isLoading, setIsLoading] = useState(false);

  const validateForm = (): boolean => {
    const validation = resetPasswordSchema.safeParse({
      password,
      confirmPassword,
    });

    if (!validation.success) {
      const newErrors: typeof errors = {};
      validation.error.issues.forEach((issue) => {
        const field = issue.path[0] as 'password' | 'confirmPassword';
        newErrors[field] = issue.message;
      });
      setErrors(newErrors);
      return false;
    }

    setErrors({});
    return true;
  };

  const handleUpdatePassword = async () => {
    if (!validateForm()) return;

    setIsLoading(true);

    try {
      const token = await SecureStore.getItemAsync('access_token');

      if (!token) {
        Alert.alert(
          'Error',
          'No active session found. Please log in again.'
        );
        setIsLoading(false);
        return;
      }

      const res = await fetch(`${AUTH_URL}/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          current_password: password,
          new_password: password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        Alert.alert('Error', data.message || 'Failed to update password');
        setIsLoading(false);
        return;
      }

      Alert.alert(
        'Success',
        'Password updated successfully!',
        [
          {
            text: 'OK',
            onPress: () => {
              setPassword('');
              setConfirmPassword('');
              router.back();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Change Password',
          headerShadowVisible: false,
        }}
      />
      <ScrollView
        className="flex-1 bg-background"
        contentContainerStyle={{ padding: 16 }}
      >
        <View className="mb-8">
          <Text className="text-2xl font-bold mb-1 text-foreground">
            Update Your Password
          </Text>
          <Text className="text-sm text-muted-foreground">
            Enter your new password below
          </Text>
        </View>

        <View className="gap-4">
          <PasswordInput
            label="New Password"
            value={password}
            onChangeText={(text) => {
              setPassword(text);
              if (errors.password) {
                setErrors((prev) => ({ ...prev, password: undefined }));
              }
            }}
            placeholder="Min. 6 characters"
            error={errors.password}
            hint={!errors.password ? 'Must be at least 6 characters' : undefined}
          />

          <PasswordInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={(text) => {
              setConfirmPassword(text);
              if (errors.confirmPassword) {
                setErrors((prev) => ({ ...prev, confirmPassword: undefined }));
              }
            }}
            placeholder="Confirm your password"
            error={errors.confirmPassword}
          />

          <Pressable
            className={`h-12 rounded-xl justify-center items-center mt-4 bg-primary ${isLoading ? 'opacity-60' : ''}`}
            onPress={handleUpdatePassword}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-base font-semibold text-primary-foreground">
                Update Password
              </Text>
            )}
          </Pressable>

          <Pressable
            className="h-12 justify-center items-center"
            onPress={() => router.back()}
            disabled={isLoading}
          >
            <Text className="text-sm underline text-muted-foreground">
              Cancel
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </>
  );
}
