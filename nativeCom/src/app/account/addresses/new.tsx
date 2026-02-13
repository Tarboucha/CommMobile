import React, { useState, useEffect } from 'react';
import { View, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@/components/ui/text';
import { AddressForm } from '@/components/pages/account/shared/address-form';
import { createAddress, getAddresses } from '@/lib/api/addresses';
import type { AddressInput } from '@/lib/validations/address';

export default function NewAddressScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingLimit, setIsCheckingLimit] = useState(true);
  const [canCreate, setCanCreate] = useState(true);

  useEffect(() => {
    checkAddressLimit();
  }, []);

  const checkAddressLimit = async () => {
    try {
      const data = await getAddresses();
      setCanCreate(data.countInfo.canCreate);

      if (!data.countInfo.canCreate) {
        Alert.alert(
          'Limit Reached',
          'You have reached the maximum of 5 addresses. Please delete one to add a new address.',
          [{ text: 'OK', onPress: () => router.back() }]
        );
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to load address information. Please try again.');
    } finally {
      setIsCheckingLimit(false);
    }
  };

  const handleSubmit = async (data: Omit<AddressInput, 'latitude' | 'longitude' | 'profile_id'>) => {
    setIsLoading(true);
    try {
      await createAddress(data);
      Alert.alert('Success', 'Address added successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';

      if (errorMessage.includes('geocod')) {
        Alert.alert(
          'Invalid Address',
          'We could not verify this address. Please check the details and try again.'
        );
      } else if (errorMessage.includes('limit')) {
        Alert.alert(
          'Limit Reached',
          'You have reached the maximum of 5 addresses. Please delete one to add a new address.'
        );
      } else {
        Alert.alert(
          'Error',
          errorMessage || 'Failed to add address. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (isCheckingLimit) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center gap-4">
          <ActivityIndicator size="large" color="#660000" />
          <Text className="text-base">Loading...</Text>
        </View>
      </View>
    );
  }

  if (!canCreate) {
    return null;
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="mb-6 gap-2">
          <Text className="text-2xl font-bold text-foreground">Add New Address</Text>
          <Text className="text-sm text-muted-foreground">
            Enter your address details below. We'll verify the location automatically.
          </Text>
        </View>

        <AddressForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={isLoading}
          submitButtonText="Add Address"
        />
      </ScrollView>
    </View>
  );
}
