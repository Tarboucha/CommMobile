import { useState } from 'react';
import {
  View,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { router, Stack } from 'expo-router';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { updateProfile } from '@/lib/api/profiles';
import { fetchMe } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useTheme } from '@/hooks/use-theme';
import { NAV_COLORS } from '@/lib/constants/nav-colors';

export default function OnboardingScreen() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const { colorScheme } = useTheme();
  const navColors = NAV_COLORS[colorScheme];

  // Prefill from profile if something's already there (Google users with
  // partial name data, or someone re-entering the screen mid-flow).
  const [firstName, setFirstName] = useState(user?.first_name ?? '');
  const [lastName, setLastName] = useState(user?.last_name ?? '');
  const [saving, setSaving] = useState(false);

  const canSubmit = firstName.trim().length > 0 && lastName.trim().length > 0 && !saving;

  const handleSubmit = async () => {
    if (!user || !canSubmit) return;

    setSaving(true);
    try {
      const first = firstName.trim();
      const last = lastName.trim();

      await updateProfile(user.id, {
        first_name: first,
        last_name: last,
        display_name: `${first} ${last}`,
      });

      // Pull the refreshed profile so the store matches server state, then
      // route into the app. After this call requiresOnboarding should be false.
      const response = await fetchMe();
      setUser(response.data.profile);

      router.replace('/(tabs)');
    } catch (err) {
      Alert.alert(
        'Could not save your profile',
        err instanceof Error ? err.message : 'Please try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Complete your profile',
          headerStyle: { backgroundColor: navColors.background },
          headerTintColor: navColors.text,
          headerShadowVisible: false,
          headerBackVisible: false,
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
                Welcome to KoDo!
              </Text>
              <Text className="text-lg text-center text-muted-foreground mb-6">
                Tell us your name
              </Text>

              <TextInput
                className="h-[50px] border border-input rounded-lg px-4 text-base bg-card text-foreground"
                placeholder="First name"
                placeholderTextColor="#6B7280"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                autoComplete="given-name"
                editable={!saving}
              />

              <TextInput
                className="h-[50px] border border-input rounded-lg px-4 text-base bg-card text-foreground"
                placeholder="Last name"
                placeholderTextColor="#6B7280"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                autoComplete="family-name"
                editable={!saving}
              />

              <Button
                className="mt-4"
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text>Continue</Text>
                )}
              </Button>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
