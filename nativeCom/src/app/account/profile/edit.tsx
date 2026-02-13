import { useState } from 'react';
import { TextInput, Pressable, ScrollView, KeyboardAvoidingView, Platform, Alert, View, Image } from 'react-native';
import { router, Stack } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/stores/auth-store';
import { updateProfile, uploadAvatar as uploadAvatarAPI, deleteAvatar as deleteAvatarAPI } from '@/lib/api/profiles';
import { getPublicUrl } from '@/lib/utils/storage';

export default function ProfileEditScreen() {
  const { user, fetchUser } = useAuthStore();

  const [firstName, setFirstName] = useState(user?.first_name || '');
  const [lastName, setLastName] = useState(user?.last_name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  if (!user) {
    return (
      <>
        <Stack.Screen options={{ title: 'Edit Profile' }} />
        <View className="flex-1 bg-background justify-center items-center">
          <Text>Not logged in</Text>
        </View>
      </>
    );
  }

  const getInitials = () => {
    if (user.first_name && user.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user.first_name) {
      return user.first_name[0].toUpperCase();
    }
    return user.email[0].toUpperCase();
  };

  const uploadAvatar = async (uri: string) => {
    setUploading(true);

    try {
      const filename = uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      const formData = new FormData();
      formData.append('file', {
        uri,
        name: filename,
        type,
      });

      await uploadAvatarAPI(user.id, formData);
      await fetchUser();
      Alert.alert('Success', 'Avatar updated successfully');
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant photo library access');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant camera access');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      await uploadAvatar(result.assets[0].uri);
    }
  };

  const handleChangePhoto = () => {
    Alert.alert(
      'Change Photo',
      'Choose an option',
      [
        { text: 'Take Photo', onPress: handleTakePhoto },
        { text: 'Choose from Library', onPress: handlePickImage },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleDeleteAvatar = async () => {
    Alert.alert(
      'Delete Photo',
      'Are you sure you want to remove your profile photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setUploading(true);

            try {
              await deleteAvatarAPI(user.id);
              await fetchUser();
              Alert.alert('Success', 'Avatar deleted successfully');
            } catch (error) {
              Alert.alert('Error', error instanceof Error ? error.message : 'Could not delete avatar');
            } finally {
              setUploading(false);
            }
          },
        },
      ]
    );
  };

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'First name and last name are required');
      return;
    }

    setLoading(true);

    try {
      await updateProfile(user.id, {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        phone: phone.trim() || null,
      });

      await fetchUser();

      Alert.alert(
        'Success',
        'Profile has been updated',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      Alert.alert('Error', error instanceof Error ? error.message : 'Could not update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Edit Profile',
          headerShadowVisible: false,
        }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1 bg-background"
      >
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="gap-6">
            {/* Avatar Section */}
            <View className="items-center gap-4 mb-6">
              <Text className="text-base font-semibold text-foreground">
                Profile Photo
              </Text>

              {/* Avatar Display */}
              <View className="w-24 h-24 rounded-full justify-center items-center overflow-hidden bg-muted">
                {user.avatar_url ? (
                  <Image
                    key={user.avatar_url}
                    source={{ uri: getPublicUrl(user.avatar_url) || '' }}
                    className="w-24 h-24"
                  />
                ) : (
                  <Text className="text-4xl font-semibold text-foreground">
                    {getInitials()}
                  </Text>
                )}
              </View>

              {/* Avatar Buttons */}
              <View className="flex-row gap-3 justify-center">
                <Pressable
                  className="py-2 px-4 rounded-xl border border-border bg-secondary"
                  onPress={handleChangePhoto}
                  disabled={uploading}
                >
                  <Text className="text-sm font-semibold text-foreground">
                    {uploading ? 'Uploading...' : 'Change Photo'}
                  </Text>
                </Pressable>

                {user.avatar_url && (
                  <Pressable
                    className="py-2 px-4 rounded-xl bg-destructive"
                    onPress={handleDeleteAvatar}
                    disabled={uploading}
                  >
                    <Text className="text-sm font-semibold text-destructive-foreground">
                      Remove Photo
                    </Text>
                  </Pressable>
                )}
              </View>

              <Text className="text-xs italic text-muted-foreground">
                Max 5MB • JPG, PNG, WEBP
              </Text>
            </View>

            {/* First Name */}
            <View className="gap-2">
              <Text className="text-base font-semibold text-foreground">
                First Name *
              </Text>
              <TextInput
                className="h-12 border border-border rounded-xl px-4 text-base bg-card text-foreground"
                placeholder="Enter first name"
                placeholderTextColor="#6B7280"
                value={firstName}
                onChangeText={setFirstName}
                editable={!loading}
                autoCapitalize="words"
              />
            </View>

            {/* Last Name */}
            <View className="gap-2">
              <Text className="text-base font-semibold text-foreground">
                Last Name *
              </Text>
              <TextInput
                className="h-12 border border-border rounded-xl px-4 text-base bg-card text-foreground"
                placeholder="Enter last name"
                placeholderTextColor="#6B7280"
                value={lastName}
                onChangeText={setLastName}
                editable={!loading}
                autoCapitalize="words"
              />
            </View>

            {/* Phone */}
            <View className="gap-2">
              <Text className="text-base font-semibold text-foreground">
                Phone
              </Text>
              <TextInput
                className="h-12 border border-border rounded-xl px-4 text-base bg-card text-foreground"
                placeholder="Enter phone number"
                placeholderTextColor="#6B7280"
                value={phone}
                onChangeText={setPhone}
                editable={!loading}
                keyboardType="phone-pad"
              />
            </View>

            {/* Email (read-only) */}
            <View className="gap-2">
              <Text className="text-base font-semibold text-foreground">
                Email
              </Text>
              <TextInput
                className="h-12 border border-border rounded-xl px-4 text-base opacity-60 bg-muted text-muted-foreground"
                value={user.email}
                editable={false}
              />
              <Text className="text-xs italic text-muted-foreground">
                Email cannot be changed
              </Text>
            </View>

            {/* Buttons */}
            <View className="gap-4 mt-6">
              <Pressable
                className={`h-12 rounded-xl justify-center items-center bg-primary ${loading ? 'opacity-50' : ''}`}
                onPress={handleSave}
                disabled={loading}
              >
                <Text className="text-base font-semibold text-primary-foreground">
                  {loading ? 'Saving...' : 'Save'}
                </Text>
              </Pressable>

              <Pressable
                className="h-12 rounded-xl justify-center items-center border border-border"
                onPress={handleCancel}
                disabled={loading}
              >
                <Text className="text-base font-semibold text-foreground">
                  Cancel
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
