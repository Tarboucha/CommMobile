import React, { useState, useEffect } from 'react';
import { View, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Text } from '@/components/ui/text';
import { AddressForm } from '@/components/pages/account/shared/address-form';
import { getAddresses, updateAddress, deleteAddress } from '@/lib/api/addresses';
import type { Address } from '@/types/address';
import type { AddressUpdateInput } from '@/lib/validations/address';

export default function EditAddressScreen() {
  const { addressId } = useLocalSearchParams<{ addressId: string }>();

  const [address, setAddress] = useState<Address | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    if (addressId) {
      fetchAddress();
    }
  }, [addressId]);

  const fetchAddress = async () => {
    try {
      const data = await getAddresses();
      const foundAddress = data.addresses.find((a) => a.id === addressId);

      if (!foundAddress) {
        Alert.alert('Error', 'Address not found.', [
          { text: 'OK', onPress: () => router.back() },
        ]);
        return;
      }

      setAddress(foundAddress);
    } catch (error) {
      Alert.alert('Error', 'Failed to load address. Please try again.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } finally {
      setIsFetching(false);
    }
  };

  const handleSubmit = async (data: Partial<AddressUpdateInput>) => {
    if (!addressId) return;

    setIsLoading(true);
    try {
      await updateAddress(addressId, data);
      Alert.alert('Success', 'Address updated successfully', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '';

      if (errorMessage.includes('geocod')) {
        Alert.alert(
          'Invalid Address',
          'We could not verify this address. Please check the details and try again.'
        );
      } else {
        Alert.alert(
          'Error',
          errorMessage || 'Failed to update address. Please try again.'
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!addressId || !address) return;

    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await deleteAddress(addressId);
              Alert.alert('Success', 'Address deleted successfully', [
                { text: 'OK', onPress: () => router.back() },
              ]);
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to delete address. Please try again.'
              );
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    router.back();
  };

  if (isFetching) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center gap-4">
          <ActivityIndicator size="large" color="#660000" />
          <Text className="text-base">Loading address...</Text>
        </View>
      </View>
    );
  }

  if (!address) {
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
          <Text className="text-2xl font-bold text-foreground">Edit Address</Text>
          <Text className="text-sm text-muted-foreground">
            Update your address details below.
          </Text>
        </View>

        <AddressForm
          initialData={address}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          onDelete={handleDelete}
          isLoading={isLoading}
          submitButtonText="Update Address"
        />
      </ScrollView>
    </View>
  );
}
