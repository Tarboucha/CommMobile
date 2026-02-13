import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import type { AddressCountInfo } from '@/types/address';
import {
  getAddressCountColor,
  getAddressCountMessage,
} from '@/lib/utils/address-ui-helpers';

interface AddressCountIndicatorProps {
  countInfo: AddressCountInfo;
}

export function AddressCountIndicator({
  countInfo,
}: AddressCountIndicatorProps) {
  const colorType = getAddressCountColor(countInfo);
  const message = getAddressCountMessage(countInfo);

  // Get color classes based on status
  const getColorClasses = () => {
    switch (colorType) {
      case 'success':
        return {
          border: 'border-green-500',
          bg: 'bg-green-100',
          text: 'text-green-600',
        };
      case 'warning':
        return {
          border: 'border-amber-500',
          bg: 'bg-amber-100',
          text: 'text-amber-600',
        };
      case 'error':
        return {
          border: 'border-red-500',
          bg: 'bg-red-100',
          text: 'text-red-600',
        };
    }
  };

  const colors = getColorClasses();

  return (
    <View className={`rounded-lg border p-4 mb-4 ${colors.border} ${colors.bg}`}>
      <View className="mb-1">
        <View className="flex-row items-baseline gap-0.5">
          <Text className={`text-3xl font-bold ${colors.text}`}>
            {countInfo.currentCount}
          </Text>
          <Text className={`text-2xl font-normal ${colors.text}`}>
            /
          </Text>
          <Text className={`text-xl font-semibold ${colors.text}`}>
            {countInfo.maxCount}
          </Text>
          <Text className={`text-sm font-medium ml-0.5 ${colors.text}`}>
            addresses
          </Text>
        </View>
      </View>

      <Text className={`text-[13px] leading-[18px] ${colors.text}`}>
        {message}
      </Text>
    </View>
  );
}
