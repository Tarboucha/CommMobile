import { useState } from 'react';
import {
  View,
  Image,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { GoogleGIcon } from '@/components/ui/google-g-icon';
import { useLogin } from '@/hooks/use-login';

function HeaderLogo() {
  return (
    <Image
      source={require('@/assets/images/icon.png')}
      style={{ width: 120, height: 40 }}
      resizeMode="contain"
    />
  );
}

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { handleLogin, handleGoogleLogin, loading } = useLogin();

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: () => <HeaderLogo />,
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#FAF7F2' },
          headerShadowVisible: false,
          headerTintColor: '#660000',
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="flex-1 px-6 pt-6 pb-10">
            {/* Header */}
            <View className="mb-10">
              <Text
                className="font-bold tracking-tight"
                style={{ color: '#660000', fontSize: 32, lineHeight: 36 }}
              >
                Welcome back
              </Text>
              <Text
                className="font-sans mt-2"
                style={{ color: '#78716C', fontSize: 16, lineHeight: 24 }}
              >
                Log in to connect with your neighbors.
              </Text>
            </View>

            {/* Email */}
            <View className="gap-2 mb-5">
              <Text
                className="font-semibold uppercase ml-1"
                style={{ color: '#78716C', fontSize: 12, letterSpacing: 0.8 }}
              >
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="hello@kodo.com"
                placeholderTextColor="#A8A29E"
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
                className="rounded-2xl h-14 px-4 font-sans"
                style={{
                  backgroundColor: '#F5E6D3',
                  color: '#1C1917',
                  fontSize: 16,
                }}
              />
            </View>

            {/* Password */}
            <View className="gap-2 mb-8">
              <View className="flex-row justify-between items-center mx-1">
                <Text
                  className="font-semibold uppercase"
                  style={{ color: '#78716C', fontSize: 12, letterSpacing: 0.8 }}
                >
                  Password
                </Text>
                <Pressable
                  onPress={() => router.push('/auth/forgot-password' as never)}
                  hitSlop={8}
                  disabled={loading}
                >
                  <Text
                    className="font-semibold"
                    style={{ color: '#660000', fontSize: 12 }}
                  >
                    Forgot password?
                  </Text>
                </Pressable>
              </View>
              <View className="relative">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#A8A29E"
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  className="rounded-2xl h-14 pl-4 pr-12 font-sans"
                  style={{
                    backgroundColor: '#F5E6D3',
                    color: '#1C1917',
                    fontSize: 16,
                  }}
                />
                <Pressable
                  onPress={() => setShowPassword((prev) => !prev)}
                  hitSlop={8}
                  className="absolute right-4 top-0 bottom-0 justify-center"
                >
                  <MaterialCommunityIcons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={22}
                    color="#78716C"
                  />
                </Pressable>
              </View>
            </View>

            {/* Primary submit */}
            <Pressable
              onPress={() => handleLogin({ email, password })}
              disabled={loading}
              className="rounded-2xl h-14 flex-row items-center justify-center gap-2 active:opacity-90"
              style={{
                backgroundColor: '#660000',
                opacity: loading ? 0.7 : 1,
                shadowColor: '#4a352f',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.12,
                shadowRadius: 20,
                elevation: 4,
              }}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text
                    className="font-semibold"
                    style={{ color: '#FFFFFF', fontSize: 16 }}
                  >
                    Log in
                  </Text>
                  <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
                </>
              )}
            </Pressable>

            {/* Divider */}
            <View className="flex-row items-center my-8">
              <View className="flex-1 h-px" style={{ backgroundColor: '#E8D5D5' }} />
              <Text
                className="font-semibold uppercase mx-4"
                style={{ color: '#78716C', fontSize: 11, letterSpacing: 1.5 }}
              >
                or continue with
              </Text>
              <View className="flex-1 h-px" style={{ backgroundColor: '#E8D5D5' }} />
            </View>

            {/* Google sign-in — custom branded */}
            <Pressable
              onPress={handleGoogleLogin}
              disabled={loading}
              className="rounded-2xl h-14 flex-row items-center justify-center gap-3 active:opacity-90"
              style={{
                backgroundColor: '#FFFFFF',
                borderWidth: 1,
                borderColor: '#E8D5D5',
                opacity: loading ? 0.7 : 1,
              }}
            >
              <GoogleGIcon size={20} />
              <Text
                className="font-semibold"
                style={{ color: '#1C1917', fontSize: 16 }}
              >
                Continue with Google
              </Text>
            </Pressable>

            {/* Sign-up prompt */}
            <View className="flex-row justify-center items-center gap-1 mt-10">
              <Text className="font-sans" style={{ color: '#78716C', fontSize: 15 }}>
                Don&apos;t have an account?
              </Text>
              <Pressable
                onPress={() => router.push('/auth/sign-up')}
                disabled={loading}
                hitSlop={8}
              >
                <Text
                  className="font-semibold underline"
                  style={{ color: '#660000', fontSize: 15 }}
                >
                  Sign up
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
