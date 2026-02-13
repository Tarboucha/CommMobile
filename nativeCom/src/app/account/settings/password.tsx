import { useState } from 'react';
import {
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  View,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Text } from '@/components/ui/text';
import { PasswordInput } from '@/components/pages/account/shared/password-input';
import { supabase } from '@/lib/supabase/client';
import { resetPasswordSchema } from '@/lib/validations/auth';

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
      const {
        data: { user: authUser },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !authUser) {
        Alert.alert(
          'Error',
          'No active session found. Please log in again.'
        );
        setIsLoading(false);
        return;
      }

      const hasEmailIdentity = authUser.identities?.some(
        (identity) => identity.provider === 'email'
      );

      if (!hasEmailIdentity) {
        Alert.alert(
          'Not Available',
          'Password change is not available for accounts that signed up with Google. Please use Google to sign in.',
          [{ text: 'OK' }]
        );
        setIsLoading(false);
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        Alert.alert('Error', updateError.message || 'Failed to update password');
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
