import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { signUp } from '@/lib/services/auth-service';
import type { SignUpCredentials } from '@/types/auth';

export function useSignUp() {
  const [loading, setLoading] = useState(false);

  const handleSignUp = async (credentials: SignUpCredentials) => {
    setLoading(true);

    try {
      const result = await signUp(credentials);

      if (!result.success && result.error) {
        switch (result.error.type) {
          case 'validation':
          case 'weak_password':
            Alert.alert('Error', result.error.message);
            break;
          case 'email_exists':
            Alert.alert('Sign Up Failed', result.error.message);
            break;
          default:
            Alert.alert('Sign Up Failed', result.error.message);
        }
        return;
      }

      if (result.requiresEmailVerification) {
        Alert.alert(
          'Success',
          'Account created! Please check your email to verify your account.',
          [{ text: 'OK', onPress: () => router.replace('/auth/login') }]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return { handleSignUp, loading };
}
