import { View, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import type { Address } from '@/types/address';
import { formatFullAddress } from '@/lib/utils/address-formatting';
import { getAddressTypeIcon, getAddressTypeLabel } from '@/lib/utils/address-ui-helpers';

interface AddressListItemProps {
  address: Address;
  onEdit: (addressId: string) => void;
  onDelete: (addressId: string) => void;
  onSetDefault: (addressId: string) => void;
  onOpenMap: (latitude: number, longitude: number) => void;
  isSettingDefault?: boolean;
  isDeleting?: boolean;
}

export function AddressListItem({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  onOpenMap,
  isSettingDefault = false,
  isDeleting = false,
}: AddressListItemProps) {
  const iconName = getAddressTypeIcon(address.address_type);
  const typeLabel = getAddressTypeLabel(address.address_type);
  const formattedAddress = formatFullAddress(address);

  const handleDelete = () => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(address.id),
        },
      ]
    );
  };

  return (
    <View className="rounded-xl border border-border p-4 mb-4 bg-card">
      {/* Header: Icon, Label, Type Badge, Default Badge */}
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-1 flex-1">
          <Ionicons
            name={iconName as keyof typeof Ionicons.glyphMap}
            size={20}
            color="#1F2937"
          />
          <Text className="text-base font-semibold">
            {address.label || typeLabel}
          </Text>
        </View>
        <View className="flex-row gap-1 flex-wrap">
          <View
            className={`px-3 py-0.5 rounded ${address.address_type === 'home' ? 'bg-primary' : 'bg-muted'}`}
          >
            <Text
              className={`text-xs font-medium ${address.address_type === 'home' ? 'text-primary-foreground' : 'text-muted-foreground'}`}
            >
              {typeLabel}
            </Text>
          </View>
          {address.is_default && (
            <View className="px-3 py-0.5 rounded border border-primary bg-primary">
              <Text className="text-xs font-semibold text-primary-foreground">
                Default
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Address Text */}
      <Text className="text-sm mb-1 leading-5 text-muted-foreground">
        {formattedAddress}
      </Text>

      {/* Delivery Instructions */}
      {address.delivery_instructions && (
        <Text className="text-[13px] italic mt-1 mb-3 text-muted-foreground">
          Note: {address.delivery_instructions}
        </Text>
      )}

      {/* Action Buttons */}
      <View className="flex-row gap-3 mt-3 flex-wrap">
        {/* Map Pin Button */}
        <TouchableOpacity
          className="flex-row items-center justify-center gap-0.5 py-3 px-3 rounded-lg border border-border min-w-[40px] bg-muted"
          onPress={() => onOpenMap(address.latitude, address.longitude)}
        >
          <Ionicons
            name="location-outline"
            size={18}
            color="#1F2937"
          />
        </TouchableOpacity>

        {/* Set Default Button */}
        {!address.is_default && (
          <TouchableOpacity
            className="flex-1 flex-row items-center justify-center gap-0.5 py-3 px-3 rounded-lg border border-border bg-muted"
            onPress={() => onSetDefault(address.id)}
            disabled={isSettingDefault}
          >
            {isSettingDefault ? (
              <ActivityIndicator size="small" color="#1F2937" />
            ) : (
              <>
                <Ionicons
                  name="star-outline"
                  size={18}
                  color="#1F2937"
                />
                <Text className="text-[13px] font-medium">
                  Set Default
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Edit Button */}
        <TouchableOpacity
          className="flex-row items-center justify-center gap-0.5 py-3 px-3 rounded-lg border border-border min-w-[40px] bg-muted"
          onPress={() => onEdit(address.id)}
        >
          <Ionicons
            name="pencil-outline"
            size={18}
            color="#1F2937"
          />
        </TouchableOpacity>

        {/* Delete Button */}
        <TouchableOpacity
          className="flex-row items-center justify-center gap-0.5 py-3 px-3 rounded-lg border border-border min-w-[40px] bg-muted"
          onPress={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <Ionicons
              name="trash-outline"
              size={18}
              color="#DC2626"
            />
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}
