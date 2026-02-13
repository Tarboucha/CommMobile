import { useState } from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { login } from '@/lib/services/auth-service';
import type { LoginCredentials } from '@/types/auth';

export function useLogin() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (credentials: LoginCredentials) => {
    setLoading(true);

    try {
      const result = await login(credentials);

      if (!result.success && result.error) {
        switch (result.error.type) {
          case 'validation':
            Alert.alert('Error', result.error.message);
            break;
          case 'invalid_credentials':
            Alert.alert('Login Failed', result.error.message);
            break;
          case 'email_not_confirmed':
            Alert.alert('Email Not Verified', result.error.message);
            break;
          case 'account_suspended':
            Alert.alert('Account Suspended', result.error.message);
            break;
          case 'payment_required':
            Alert.alert('Payment Required', result.error.message);
            break;
          default:
            Alert.alert('Login Failed', result.error.message);
        }
        return;
      }

      if (result.requiresOnboarding) {
        Alert.alert(
          'Complete Your Profile',
          'Please complete your profile to continue.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
        );
        return;
      }

      if (result.requiresProfileCompletion) {
        Alert.alert(
          'Complete Your Profile',
          'Please add your name and phone number.',
          [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
        );
        return;
      }

      router.replace('/(tabs)');
    } finally {
      setLoading(false);
    }
  };

  return { handleLogin, loading };
}
