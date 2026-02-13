import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Pressable,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { AddressCountIndicator } from '@/components/pages/account/shared/address-count-indicator';
import { AddressListItem } from '@/components/pages/account/shared/address-list-item';
import {
  getAddresses,
  deleteAddress,
  setDefaultAddress,
} from '@/lib/api/addresses';
import { openAddressInMaps } from '@/lib/utils/address-ui-helpers';
import { extractCoordinates } from '@/lib/utils/address-formatting';
import type { Address, AddressCountInfo } from '@/types/address';

export default function AddressesScreen() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [countInfo, setCountInfo] = useState<AddressCountInfo>({
    currentCount: 0,
    maxCount: 5,
    canCreate: true,
    isNearLimit: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadingStates, setLoadingStates] = useState<Record<string, string>>({});

  const fetchAddressesData = useCallback(async () => {
    try {
      const data = await getAddresses();
      setAddresses(data.addresses);
      setCountInfo(data.countInfo);
    } catch (error) {
      Alert.alert(
        'Error',
        'Failed to load addresses. Please try again.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAddressesData();
  }, [fetchAddressesData]);

  useFocusEffect(
    useCallback(() => {
      fetchAddressesData();
    }, [fetchAddressesData])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAddressesData();
  }, [fetchAddressesData]);

  const handleAddAddress = () => {
    if (!countInfo.canCreate) {
      Alert.alert(
        'Limit Reached',
        'You have reached the maximum of 5 addresses. Please delete one to add a new address.'
      );
      return;
    }
    router.push('/account/addresses/new');
  };

  const handleEdit = (addressId: string) => {
    router.push(`/account/addresses/${addressId}/edit`);
  };

  const handleDelete = (addressId: string) => {
    const address = addresses.find((a) => a.id === addressId);
    if (!address) return;

    Alert.alert(
      'Delete Address',
      `Are you sure you want to delete this address?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setLoadingStates((prev) => ({ ...prev, [addressId]: 'deleting' }));
            try {
              await deleteAddress(addressId);
              await fetchAddressesData();
              Alert.alert('Success', 'Address deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete address. Please try again.');
            } finally {
              setLoadingStates((prev) => {
                const { [addressId]: _, ...rest } = prev;
                return rest;
              });
            }
          },
        },
      ]
    );
  };

  const handleSetDefault = async (addressId: string) => {
    const address = addresses.find((a) => a.id === addressId);
    if (!address) return;

    if (address.is_default) {
      Alert.alert('Info', 'This address is already your default address.');
      return;
    }

    setLoadingStates((prev) => ({ ...prev, [addressId]: 'setting-default' }));
    try {
      await setDefaultAddress(addressId);
      await fetchAddressesData();
      Alert.alert('Success', 'Default address updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to set default address. Please try again.');
    } finally {
      setLoadingStates((prev) => {
        const { [addressId]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const handleOpenMap = async (addressId: string) => {
    const address = addresses.find((a) => a.id === addressId);
    if (!address) return;

    const coords = extractCoordinates(address);
    if (!coords) {
      Alert.alert(
        'No Coordinates',
        'This address does not have location coordinates.'
      );
      return;
    }

    try {
      await openAddressInMaps(coords.latitude, coords.longitude);
    } catch (error) {
      Alert.alert(
        'Error',
        'Unable to open maps. Please make sure you have a maps app installed.'
      );
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 bg-background">
        <View className="flex-1 justify-center items-center gap-4">
          <ActivityIndicator size="large" color="#660000" />
          <Text className="text-base">Loading addresses...</Text>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#660000"
          />
        }
      >
        <View className="mb-6 gap-4">
          <Text className="text-2xl font-bold text-foreground">My Addresses</Text>
          <AddressCountIndicator countInfo={countInfo} />
        </View>

        {addresses.length === 0 ? (
          <View className="items-center justify-center py-12 gap-4">
            <Ionicons
              name="location-outline"
              size={64}
              color="#6B7280"
            />
            <Text className="text-xl font-semibold mt-4">No Addresses</Text>
            <Text className="text-sm text-center px-8 text-muted-foreground">
              You haven't added any addresses yet. Add your first address to get
              started.
            </Text>
          </View>
        ) : (
          <View className="gap-4">
            {addresses.map((address) => (
              <AddressListItem
                key={address.id}
                address={address}
                onEdit={() => handleEdit(address.id)}
                onDelete={() => handleDelete(address.id)}
                onSetDefault={() => handleSetDefault(address.id)}
                onOpenMap={() => handleOpenMap(address.id)}
                isDeleting={loadingStates[address.id] === 'deleting'}
                isSettingDefault={loadingStates[address.id] === 'setting-default'}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <View className="p-4 border-t border-border bg-background">
        <Pressable
          className={`flex-row items-center justify-center py-4 px-6 rounded-xl gap-2 ${
            countInfo.canCreate ? 'bg-primary' : 'bg-muted'
          }`}
          onPress={handleAddAddress}
          disabled={!countInfo.canCreate}
        >
          <Ionicons
            name="add-circle-outline"
            size={24}
            color={countInfo.canCreate ? 'white' : '#6B7280'}
          />
          <Text
            className={`text-base font-semibold ${
              countInfo.canCreate ? 'text-primary-foreground' : 'text-muted-foreground'
            }`}
          >
            Add Address
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
