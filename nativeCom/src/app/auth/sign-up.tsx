import { useState } from 'react';
import { View, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router, Stack } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/pages/account/shared/password-input';
import { useSignUp } from '@/hooks/use-sign-up';
import { useTheme } from '@/hooks/use-theme';
import { NAV_COLORS } from '@/lib/constants/nav-colors';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { handleSignUp, loading } = useSignUp();
  const { colorScheme } = useTheme();
  const navColors = NAV_COLORS[colorScheme];

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Sign Up',
          headerStyle: {
            backgroundColor: navColors.background,
          },
          headerTintColor: navColors.text,
          headerShadowVisible: false,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="flex-1 bg-background justify-center p-6">
            <View className="gap-4">
              <Text className="text-3xl font-bold text-center mb-1">
                Welcome to KoDo
              </Text>
              <Text className="text-lg text-center text-muted-foreground mb-6">
                Create your account
              </Text>

              <TextInput
                className="h-[50px] border border-input rounded-lg px-4 text-base bg-card text-foreground"
                placeholder="Email"
                placeholderTextColor="#6B7280"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />

              <PasswordInput
                label=""
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                hint="Must be at least 6 characters"
              />

              <PasswordInput
                label=""
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm Password"
              />

              <Button
                className="mt-4"
                onPress={() => handleSignUp({ email, password, confirmPassword })}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text>Sign Up</Text>
                )}
              </Button>

              <View className="flex-row justify-center items-center gap-1 mt-6">
                <Text className="text-base text-muted-foreground">Already have an account?</Text>
                <Pressable onPress={() => router.push('/auth/login')}>
                  <Text className="text-base font-semibold text-primary underline">
                    Login
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
