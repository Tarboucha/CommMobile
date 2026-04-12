import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { formatMessageTime } from '@/lib/utils/chat';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message: ChatMessage;
}

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

export function OfferResponsePill({ message }: Props) {
  const meta = message.metadata as {
    action?: string;
    agreed_amount?: number;
    currency?: string;
  } | null;

  const action = meta?.action ?? 'unknown';
  const agreedAmount = meta?.agreed_amount;
  const currency = meta?.currency ?? 'EUR';

  let label: string;
  let color: string;
  let icon: string;

  switch (action) {
    case 'accepted':
      label = agreedAmount
        ? `Offer accepted — ${formatCurrency(agreedAmount, currency)}`
        : 'Offer accepted';
      color = '#059669';
      icon = 'checkmark-circle';
      break;
    case 'declined':
      label = 'Offer declined';
      color = '#EF4444';
      icon = 'close-circle';
      break;
    case 'expired':
      label = 'Offer expired';
      color = '#9CA3AF';
      icon = 'time-outline';
      break;
    default:
      label = message.content ?? 'Offer updated';
      color = '#6B7280';
      icon = 'information-circle-outline';
  }

  return (
    <View className="items-center my-3">
      <View
        className="flex-row items-center gap-1.5 px-4 py-2 rounded-full"
        style={{ backgroundColor: color + '15' }}
      >
        <Ionicons name={icon as any} size={16} color={color} />
        <Text className="text-xs font-semibold" style={{ color }}>
          {label}
        </Text>
      </View>
      <Text className="text-[10px] text-muted-foreground mt-0.5">
        {formatMessageTime(message.created_at)}
      </Text>
    </View>
  );
}
