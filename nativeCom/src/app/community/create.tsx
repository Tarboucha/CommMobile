import { useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router, Stack } from 'expo-router';
import type { Href } from 'expo-router';
import { Text } from '@/components/ui/text';
import { createCommunity } from '@/lib/api/communities';
import type { CommunityAccessType } from '@/types/community';

const ACCESS_OPTIONS: { value: CommunityAccessType; label: string; desc: string }[] = [
  { value: 'open', label: 'Open', desc: 'Anyone can join' },
  { value: 'request_to_join', label: 'Request', desc: 'Members must be approved' },
  { value: 'invite_only', label: 'Invite Only', desc: 'Only invited users can join' },
];

export default function CreateCommunityScreen() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [accessType, setAccessType] = useState<CommunityAccessType>('open');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Error', 'Community name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const community = await createCommunity({
        community_name: trimmedName,
        community_description: description.trim() || null,
        access_type: accessType,
      });
      router.replace(`/community/${community.id}` as Href);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create community.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: true, title: 'Create Community' }} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          className="flex-1 bg-background"
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Name */}
          <Text className="text-sm font-medium text-foreground mb-2">
            Community Name *
          </Text>
          <TextInput
            className="border border-border rounded-xl px-4 py-3 mb-5 text-foreground bg-card"
            value={name}
            onChangeText={setName}
            placeholder="e.g. My Neighbourhood"
            placeholderTextColor="#9CA3AF"
            maxLength={100}
            autoFocus
          />

          {/* Description */}
          <Text className="text-sm font-medium text-foreground mb-2">
            Description
          </Text>
          <TextInput
            className="border border-border rounded-xl px-4 py-3 mb-5 text-foreground bg-card"
            value={description}
            onChangeText={setDescription}
            placeholder="What is this community about?"
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={4}
            maxLength={1000}
            textAlignVertical="top"
            style={{ minHeight: 100 }}
          />

          {/* Access Type */}
          <Text className="text-sm font-medium text-foreground mb-3">
            Access Type
          </Text>
          <View className="gap-2 mb-6">
            {ACCESS_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                className={`flex-row items-center p-4 rounded-xl border ${
                  accessType === opt.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card'
                }`}
                onPress={() => setAccessType(opt.value)}
              >
                <View
                  className={`w-5 h-5 rounded-full border-2 mr-3 justify-center items-center ${
                    accessType === opt.value ? 'border-primary' : 'border-muted-foreground'
                  }`}
                >
                  {accessType === opt.value && (
                    <View className="w-2.5 h-2.5 rounded-full bg-primary" />
                  )}
                </View>
                <View>
                  <Text className="text-sm font-medium text-foreground">{opt.label}</Text>
                  <Text className="text-xs text-muted-foreground">{opt.desc}</Text>
                </View>
              </Pressable>
            ))}
          </View>

          {/* Submit */}
          <Pressable
            className={`p-4 rounded-xl ${
              isSubmitting ? 'bg-primary/60' : 'bg-primary active:bg-primary/80'
            }`}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text className="text-sm font-semibold text-primary-foreground text-center">
              {isSubmitting ? 'Creating...' : 'Create Community'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
