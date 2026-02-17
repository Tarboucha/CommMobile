import { useState, useEffect } from 'react';
import {
  View,
  ActivityIndicator,
  TextInput,
  Pressable,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/stores/auth-store';
import { updateProfile } from '@/lib/api/profiles';
import type { PhoneNumberDisplayProps } from '@/types/phone-number-display';

/**
 * PhoneNumberDisplay - Reusable component to display and edit phone number in checkout
 * Shows phone number with edit option, or empty state prompting user to add one
 * Supports inline editing with option to save to profile
 */
export function PhoneNumberDisplay({ style, onPhoneChange }: PhoneNumberDisplayProps) {
  const { user, isLoading, isInitialized, fetchUser } = useAuthStore();

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');
  const [saveToProfile, setSaveToProfile] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Initialize phone value from user profile
  useEffect(() => {
    if (user?.phone) {
      setPhoneValue(user.phone);
    }
  }, [user?.phone]);

  // Notify parent of initial phone value
  useEffect(() => {
    if (onPhoneChange && user?.phone) {
      onPhoneChange(user.phone);
    }
  }, [user?.phone, onPhoneChange]);

  /**
   * Handle saving phone number
   * - If saveToProfile is checked: PATCH profile API to update profile
   * - Always: notify parent component of the phone value
   */
  const handleSave = async () => {
    const trimmedPhone = phoneValue.trim();

    // Validate phone (basic validation)
    if (!trimmedPhone) {
      setEditError('Please enter a phone number');
      return;
    }

    setIsSaving(true);
    setEditError(null);

    try {
      if (saveToProfile && user?.id) {
        await updateProfile(user.id, { phone: trimmedPhone });
        await fetchUser();
      }

      // Notify parent of new phone value
      if (onPhoneChange) {
        onPhoneChange(trimmedPhone);
      }

      setIsEditing(false);
      setIsSaving(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : 'Failed to save phone number');
      setIsSaving(false);
    }
  };

  /**
   * Handle cancel - reset to original value
   */
  const handleCancel = () => {
    setPhoneValue(user?.phone || '');
    setIsEditing(false);
    setEditError(null);
  };

  /**
   * Enter edit mode
   */
  const handleEdit = () => {
    setPhoneValue(user?.phone || '');
    setIsEditing(true);
    setEditError(null);
  };

  // Show loading state while auth is initializing
  if (!isInitialized || isLoading) {
    return (
      <View className="p-4 rounded-lg gap-4 bg-card" style={style}>
        <View className="flex-row items-center gap-1">
          <Ionicons name="call" size={20} color="#1F2937" />
          <Text className="text-lg font-semibold">Phone Number</Text>
        </View>
        <View className="items-center justify-center py-6">
          <ActivityIndicator size="small" color="#660000" />
        </View>
      </View>
    );
  }

  // Check if phone is missing (show empty state or edit mode)
  const hasPhone = user?.phone && user.phone.trim() !== '';

  // Edit mode UI
  if (isEditing || !hasPhone) {
    return (
      <View className="p-4 rounded-lg gap-4 bg-card" style={style}>
        <View className="flex-row items-center gap-1">
          <Ionicons name="call" size={20} color="#1F2937" />
          <Text className="text-lg font-semibold">Phone Number</Text>
        </View>

        {/* Error message */}
        {editError && (
          <View className="flex-row items-center gap-1 p-3 rounded bg-destructive/20">
            <Ionicons name="alert-circle" size={16} color="#DC2626" />
            <Text className="text-xs flex-1 text-destructive">
              {editError}
            </Text>
          </View>
        )}

        {/* Phone input */}
        <TextInput
          className={`border rounded-lg p-3 text-base bg-background text-foreground ${editError ? 'border-destructive' : 'border-border'}`}
          placeholder="Enter your phone number"
          placeholderTextColor="#6B7280"
          value={phoneValue}
          onChangeText={setPhoneValue}
          keyboardType="phone-pad"
          autoComplete="tel"
          editable={!isSaving}
        />

        {/* Save to profile toggle */}
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-sm font-medium">Save to my profile</Text>
            <Text className="text-xs text-muted-foreground">
              Use for future orders
            </Text>
          </View>
          <Switch
            value={saveToProfile}
            onValueChange={setSaveToProfile}
            trackColor={{ false: '#E5E7EB', true: '#66000080' }}
            thumbColor={saveToProfile ? '#660000' : '#6B7280'}
            disabled={isSaving}
          />
        </View>

        {/* Action buttons */}
        <View className="flex-row gap-3">
          {hasPhone && (
            <Pressable
              className="flex-1 py-3 px-4 rounded-lg border border-border items-center justify-center"
              onPress={handleCancel}
              disabled={isSaving}
            >
              <Text className="text-sm font-medium">Cancel</Text>
            </Pressable>
          )}
          <Pressable
            className={`flex-1 py-3 px-4 rounded-lg items-center justify-center min-h-[40px] bg-primary ${(!phoneValue.trim() || isSaving) ? 'opacity-60' : ''}`}
            onPress={handleSave}
            disabled={!phoneValue.trim() || isSaving}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text className="text-sm font-semibold text-primary-foreground">
                {hasPhone ? 'Save' : 'Add Phone'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  // Display mode - show phone number with edit button
  return (
    <View className="p-4 rounded-lg gap-4 bg-card" style={style}>
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-1">
          <Ionicons name="call" size={20} color="#1F2937" />
          <Text className="text-lg font-semibold">Phone Number</Text>
        </View>
        <Pressable className="flex-row items-center gap-1 py-1 px-3" onPress={handleEdit}>
          <Ionicons name="pencil" size={16} color="#660000" />
          <Text className="text-sm font-medium text-primary">
            Edit
          </Text>
        </Pressable>
      </View>
      <View className="flex-row items-center gap-1">
        <Ionicons name="checkmark-circle" size={18} color="#10B981" />
        <Text className="text-base font-medium">{user?.phone}</Text>
      </View>
      <Text className="text-xs text-muted-foreground">
        This phone number will be used for order updates and communication.
      </Text>
    </View>
  );
}
