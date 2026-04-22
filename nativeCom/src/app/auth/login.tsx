import { useState } from 'react';
import { View, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { GoogleSigninButton } from '@react-native-google-signin/google-signin';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/pages/account/shared/password-input';
import { useLogin } from '@/hooks/use-login';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { handleLogin, handleGoogleLogin, loading } = useLogin();

  return (
    <View className="flex-1 bg-background justify-center p-6">
      <View className="gap-4">
        <Text className="text-3xl font-bold text-center mb-2">
          Welcome to KoDo
        </Text>
        <Text className="text-lg text-center mb-6 text-muted-foreground">
          Sign in to continue
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
        />

        <Button
          className="mt-2"
          onPress={() => handleLogin({ email, password })}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text>Sign In</Text>
          )}
        </Button>

        <View className="flex-row items-center my-2">
          <View className="flex-1 h-px bg-border" />
          <Text className="px-3 text-sm text-muted-foreground">or</Text>
          <View className="flex-1 h-px bg-border" />
        </View>

        <View className="items-center">
          <GoogleSigninButton
            size={GoogleSigninButton.Size.Wide}
            color={GoogleSigninButton.Color.Dark}
            onPress={handleGoogleLogin}
            disabled={loading}
          />
        </View>

        <View className="flex-row justify-center items-center gap-1 mt-6">
          <Text className="text-base text-muted-foreground">Don&apos;t have an account?</Text>
          <Pressable onPress={() => router.push('/auth/sign-up')} disabled={loading}>
            <Text className="text-base font-semibold text-primary underline">
              Sign Up
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
