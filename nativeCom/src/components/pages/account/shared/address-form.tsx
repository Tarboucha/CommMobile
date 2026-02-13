import { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { Text } from '@/components/ui/text';
import { AddressTypePicker } from './address-type-picker';
import type { Address } from '@/types/address';
import type { AddressInput } from '@/lib/validations/address';

interface AddressFormProps {
  initialData?: Address;
  onSubmit: (data: Omit<AddressInput, 'latitude' | 'longitude' | 'profile_id'>) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => Promise<void>;
  isLoading: boolean;
  submitButtonText?: string;
}

interface FormErrors {
  street_name?: string;
  city?: string;
  postal_code?: string;
  country?: string;
}

export function AddressForm({
  initialData,
  onSubmit,
  onCancel,
  onDelete,
  isLoading,
  submitButtonText = 'Save Address',
}: AddressFormProps) {
  // Form state
  const [streetNumber, setStreetNumber] = useState(initialData?.street_number || '');
  const [streetName, setStreetName] = useState(initialData?.street_name || '');
  const [apartmentUnit, setApartmentUnit] = useState(initialData?.apartment_unit || '');
  const [city, setCity] = useState(initialData?.city || '');
  const [state, setState] = useState(initialData?.state || '');
  const [postalCode, setPostalCode] = useState(initialData?.postal_code || '');
  const [country, setCountry] = useState(initialData?.country || 'United States');
  const [addressType, setAddressType] = useState<'home' | 'work' | 'other'>(
    initialData?.address_type || 'home'
  );
  const [label, setLabel] = useState(initialData?.label || '');
  const [deliveryInstructions, setDeliveryInstructions] = useState(
    initialData?.delivery_instructions || ''
  );
  const [isDefault, setIsDefault] = useState(initialData?.is_default ?? true);
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!streetName.trim()) {
      newErrors.street_name = 'Street name is required';
    }
    if (!city.trim()) {
      newErrors.city = 'City is required';
    }
    if (!postalCode.trim()) {
      newErrors.postal_code = 'Postal code is required';
    }
    if (!country.trim()) {
      newErrors.country = 'Country is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    const formData = {
      street_number: streetNumber || null,
      street_name: streetName,
      apartment_unit: apartmentUnit || null,
      city: city,
      state: state || undefined,
      postal_code: postalCode,
      country: country,
      address_type: addressType,
      label: label || null,
      delivery_instructions: deliveryInstructions || null,
      is_default: isDefault,
      is_active: true,
    };

    await onSubmit(formData);
  };

  const renderInput = (
    inputLabel: string,
    value: string,
    onChangeText: (text: string) => void,
    options: {
      placeholder?: string;
      error?: string;
      multiline?: boolean;
      required?: boolean;
    } = {}
  ) => {
    const { placeholder, error, multiline = false, required = false } = options;

    return (
      <View className="mb-4">
        <Text className="text-sm font-semibold mb-1">
          {inputLabel}
          {required && <Text className="text-destructive"> *</Text>}
        </Text>
        <TextInput
          className={`border rounded-lg px-4 py-3 text-base bg-muted text-foreground ${error ? 'border-destructive' : 'border-border'} ${multiline ? 'h-20 pt-3' : ''}`}
          style={multiline ? { textAlignVertical: 'top' } : undefined}
          value={value}
          onChangeText={(text) => {
            onChangeText(text);
            if (error) {
              setErrors((prev) => ({ ...prev, [inputLabel.toLowerCase().replace(' ', '_')]: undefined }));
            }
          }}
          placeholder={placeholder}
          placeholderTextColor="#6B7280"
          multiline={multiline}
          numberOfLines={multiline ? 3 : 1}
          editable={!isLoading}
        />
        {error && (
          <Text className="text-xs mt-0.5 text-destructive">
            {error}
          </Text>
        )}
      </View>
    );
  };

  return (
    <ScrollView
      className="flex-1"
      contentContainerStyle={{ padding: 16 }}
      keyboardShouldPersistTaps="handled"
    >
      {/* Address Type */}
      <View className="mb-6">
        <Text className="text-base font-semibold mb-3">Address Type</Text>
        <AddressTypePicker value={addressType} onChange={setAddressType} />
      </View>

      {/* Custom Label (Optional) */}
      {renderInput('Label (Optional)', label, setLabel, {
        placeholder: 'e.g., Home, Office, Mom\'s House',
      })}

      {/* Street Number (Optional) */}
      {renderInput('Street Number', streetNumber, setStreetNumber, {
        placeholder: '123',
      })}

      {/* Street Name (Required) */}
      {renderInput('Street Name', streetName, setStreetName, {
        placeholder: 'Main Street',
        required: true,
        error: errors.street_name,
      })}

      {/* Apartment/Unit (Optional) */}
      {renderInput('Apartment/Unit', apartmentUnit, setApartmentUnit, {
        placeholder: 'Apt 4B',
      })}

      {/* City (Required) */}
      {renderInput('City', city, setCity, {
        placeholder: 'Springfield',
        required: true,
        error: errors.city,
      })}

      {/* State (Optional) */}
      {renderInput('State/Province', state, setState, {
        placeholder: 'IL',
      })}

      {/* Postal Code (Required) */}
      {renderInput('Postal Code', postalCode, setPostalCode, {
        placeholder: '62701',
        required: true,
        error: errors.postal_code,
      })}

      {/* Country (Required) */}
      {renderInput('Country', country, setCountry, {
        placeholder: 'United States',
        required: true,
        error: errors.country,
      })}

      {/* Delivery Instructions (Optional) */}
      {renderInput(
        'Delivery Instructions',
        deliveryInstructions,
        setDeliveryInstructions,
        {
          placeholder: 'e.g., Ring doorbell twice, leave at side door',
          multiline: true,
        }
      )}

      {/* Set as Default */}
      <View className="flex-row justify-between items-center mb-8 py-3">
        <View className="flex-1 mr-4">
          <Text className="text-sm font-semibold mb-0.5">Set as default address</Text>
          <Text className="text-xs text-muted-foreground">
            This address will be used by default for orders
          </Text>
        </View>
        <Switch
          value={isDefault}
          onValueChange={setIsDefault}
          disabled={isLoading}
          trackColor={{
            false: '#E5E7EB',
            true: '#660000',
          }}
          thumbColor="#FFFFFF"
        />
      </View>

      {/* Buttons */}
      <View className="gap-4 mt-6">
        <TouchableOpacity
          className={`h-12 rounded-lg justify-center items-center bg-primary ${isLoading ? 'opacity-60' : ''}`}
          onPress={handleSubmit}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-base font-semibold text-primary-foreground">
              {submitButtonText}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="h-12 rounded-lg justify-center items-center border border-border"
          onPress={onCancel}
          disabled={isLoading}
        >
          <Text className="text-base font-semibold">Cancel</Text>
        </TouchableOpacity>

        {onDelete && (
          <TouchableOpacity
            className="h-12 rounded-lg justify-center items-center bg-destructive"
            onPress={onDelete}
            disabled={isLoading}
          >
            <Text className="text-base font-semibold text-destructive-foreground">
              Delete Address
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}
