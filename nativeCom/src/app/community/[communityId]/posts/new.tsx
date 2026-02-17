import { useState } from 'react';
import {
  View,
  ScrollView,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { createPost } from '@/lib/api/board';

export default function NewPostScreen() {
  const { communityId } = useLocalSearchParams<{ communityId: string }>();
  const router = useRouter();

  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = body.trim().length > 0 && !isSubmitting;

  async function handlePublish() {
    if (!canSubmit || !communityId) return;

    try {
      setIsSubmitting(true);
      await createPost(communityId, {
        body: body.trim(),
        image_url: imageUrl.trim() || null,
        link_url: linkUrl.trim() || null,
      });
      router.back();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create post.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: true,
          title: 'New Post',
          headerLeft: () => (
            <Pressable onPress={() => router.back()} className="mr-2">
              <Ionicons name="close" size={24} color="#78716C" />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={handlePublish}
              disabled={!canSubmit}
              className="px-4 py-1.5 rounded-full bg-primary active:opacity-80"
              style={{ opacity: canSubmit ? 1 : 0.4 }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text className="text-sm font-semibold text-white">Publish</Text>
              )}
            </Pressable>
          ),
        }}
      />
      <KeyboardAvoidingView
        className="flex-1 bg-background"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          className="flex-1"
          contentContainerStyle={{ padding: 16 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Body */}
          <TextInput
            className="text-base text-foreground min-h-[160px]"
            placeholder="What's on your mind?"
            placeholderTextColor="#a1a1aa"
            value={body}
            onChangeText={setBody}
            multiline
            textAlignVertical="top"
            autoFocus
          />

          {/* Image URL */}
          <View className="mt-6 gap-1">
            <Text className="text-xs text-muted-foreground mb-1">Image URL (optional)</Text>
            <View className="flex-row items-center border border-border rounded-lg bg-card overflow-hidden">
              <View className="px-3">
                <Ionicons name="image-outline" size={18} color="#78716C" />
              </View>
              <TextInput
                className="flex-1 py-3 pr-4 text-sm text-foreground"
                placeholder="https://example.com/image.jpg"
                placeholderTextColor="#a1a1aa"
                value={imageUrl}
                onChangeText={setImageUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          </View>

          {/* Image preview */}
          {imageUrl.trim().length > 0 && (
            <View className="mt-3 rounded-lg overflow-hidden">
              <Image
                source={{ uri: imageUrl.trim() }}
                className="w-full rounded-lg"
                style={{ aspectRatio: 16 / 9 }}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Link URL */}
          <View className="mt-4 gap-1">
            <Text className="text-xs text-muted-foreground mb-1">Link URL (optional)</Text>
            <View className="flex-row items-center border border-border rounded-lg bg-card overflow-hidden">
              <View className="px-3">
                <Ionicons name="globe-outline" size={18} color="#78716C" />
              </View>
              <TextInput
                className="flex-1 py-3 pr-4 text-sm text-foreground"
                placeholder="https://example.com"
                placeholderTextColor="#a1a1aa"
                value={linkUrl}
                onChangeText={setLinkUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
