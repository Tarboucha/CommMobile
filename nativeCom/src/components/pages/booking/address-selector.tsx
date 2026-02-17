import { useEffect, useState, useCallback } from 'react';
import { View, Pressable, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { useAuthStore } from '@/lib/stores/auth-store';
import { getAddresses } from '@/lib/api/addresses';
import type { Address } from '@/types/address';
import type { AddressSelectorProps } from '@/types/booking';
import { handleError } from '@/lib/services/error-service';

/**
 * AddressSelector - Reusable address selection component
 * Fetches and displays user addresses with radio button selection
 */
export function AddressSelector({
  selectedAddressId,
  onSelect,
  onAddNew,
}: AddressSelectorProps) {
  const { user } = useAuthStore();

  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAddresses = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getAddresses();

      if (result.addresses) {
        setAddresses(result.addresses);
        // Auto-select default address if no selection
        if (!selectedAddressId) {
          const defaultAddress = result.addresses.find((addr) => addr.is_default);
          if (defaultAddress) {
            onSelect(defaultAddress.id);
          }
        }
      }
    } catch (error) {
      handleError(error, { severity: 'toast', screen: 'address-selector', userMessage: 'Adressen konnten nicht geladen werden' });
    } finally {
      setIsLoading(false);
    }
  }, [selectedAddressId, onSelect]);

  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user, fetchAddresses]);

  const getAddressTypeIcon = (type: string): keyof typeof Ionicons.glyphMap => {
    switch (type) {
      case 'home':
        return 'home-outline';
      case 'work':
        return 'briefcase-outline';
      default:
        return 'ellipsis-horizontal-outline';
    }
  };

  const getAddressTypeLabel = (type: string) => {
    switch (type) {
      case 'home':
        return 'Home';
      case 'work':
        return 'Work';
      default:
        return 'Other';
    }
  };

  const formatAddress = (address: Address) => {
    const streetParts = [];
    if (address.street_name) streetParts.push(address.street_name);
    if (address.street_number) streetParts.push(address.street_number);

    const parts = [
      streetParts.length > 0 ? streetParts.join(' ') : null,
      address.apartment_unit && `Apt ${address.apartment_unit}`,
      address.city,
      address.state,
      address.postal_code,
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleAddNew = () => {
    if (onAddNew) {
      onAddNew();
    } else {
      // Navigate to addresses management - will be implemented in checkout screen
      router.push('/account');
    }
  };

  if (isLoading) {
    return (
      <View className="gap-4 bg-transparent">
        <Text className="text-lg font-semibold">Delivery Address</Text>
        <View className="p-8 items-center justify-center">
          <ActivityIndicator size="large" color="#660000" />
        </View>
      </View>
    );
  }

  if (addresses.length === 0) {
    return (
      <View className="gap-4 bg-transparent">
        <Text className="text-lg font-semibold">Delivery Address</Text>
        <View className="p-8 items-center gap-4">
          <Ionicons
            name="location-outline"
            size={48}
            color="#6B7280"
          />
          <Text className="text-base font-semibold">No addresses found</Text>
          <Text className="text-sm text-center opacity-70">
            Add a delivery address to continue
          </Text>
          <Pressable
            className="flex-row items-center justify-center gap-1 px-4 py-3 rounded-lg border border-primary bg-background"
            onPress={handleAddNew}
          >
            <Ionicons name="add-outline" size={20} color="#660000" />
            <Text className="text-base font-semibold text-primary">
              Add New Address
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="gap-4 bg-transparent">
      <View className="flex-row justify-between items-center">
        <Text className="text-lg font-semibold">Delivery Address</Text>
        {onAddNew && (
          <Pressable onPress={handleAddNew} className="flex-row items-center gap-1 px-3 py-1">
            <Ionicons name="add-outline" size={20} color="#660000" />
            <Text className="text-sm font-medium text-primary">
              Add New
            </Text>
          </Pressable>
        )}
      </View>

      <View className="gap-4">
        {addresses.map((address) => {
          const isSelected = selectedAddressId === address.id;
          return (
            <Pressable
              key={address.id}
              className={`flex-row p-4 rounded-lg border-2 ${isSelected ? 'border-primary bg-secondary' : 'border-border bg-card'}`}
              onPress={() => onSelect(address.id)}
            >
              <View className="mr-3">
                <View
                  className={`w-6 h-6 rounded-full border-2 items-center justify-center ${isSelected ? 'border-primary' : 'border-border'}`}
                >
                  {isSelected && (
                    <View className="w-3 h-3 rounded-full bg-primary" />
                  )}
                </View>
              </View>

              <View className="flex-1 gap-1">
                <View className="flex-row items-center flex-wrap gap-1">
                  <Ionicons
                    name={getAddressTypeIcon(address.address_type)}
                    size={16}
                    color="#1F2937"
                    style={{ marginRight: 2 }}
                  />
                  <Text className="text-base font-semibold">
                    {address.label || getAddressTypeLabel(address.address_type)}
                  </Text>
                  {address.is_default && (
                    <View className="px-3 py-0.5 rounded bg-primary/20">
                      <Text className="text-xs font-semibold text-primary">
                        Default
                      </Text>
                    </View>
                  )}
                </View>
                <Text className="text-sm opacity-70">
                  {formatAddress(address)}
                </Text>
                {address.delivery_instructions && (
                  <Text className="text-xs opacity-60 italic">
                    Note: {address.delivery_instructions}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
