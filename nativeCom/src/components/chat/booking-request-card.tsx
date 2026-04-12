import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message: ChatMessage;
}

function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency}`;
}

export function BookingRequestCard({ message }: Props) {
  const meta = message.metadata as {
    booking_id?: string;
    total_amount?: number;
    currency?: string;
    items_summary?: Array<{
      snapshot_title: string;
      quantity: number;
      total_amount: number;
      fulfillment_method: string;
      is_loan: boolean;
      instance_date: string | null;
      instance_start_time: string | null;
    }>;
  } | null;

  const totalAmount = meta?.total_amount ?? 0;
  const currency = meta?.currency ?? 'EUR';
  const items = meta?.items_summary ?? [];

  return (
    <View className="mx-4 mb-3">
      <View className="rounded-2xl border border-primary/30 bg-primary/5 overflow-hidden">
        {/* Header */}
        <View className="flex-row items-center gap-2 px-4 py-3 bg-primary/10">
          <Ionicons name="receipt-outline" size={18} color="#660000" />
          <Text className="text-xs font-bold uppercase tracking-wide text-primary">
            Booking Request
          </Text>
        </View>

        {/* Items */}
        <View className="px-4 py-3 gap-2">
          {items.map((item, idx) => (
            <View key={idx} className="flex-row justify-between items-start">
              <View className="flex-1 mr-3">
                <Text className="text-sm font-semibold text-foreground" numberOfLines={2}>
                  {item.snapshot_title}
                </Text>
                <View className="flex-row items-center gap-2 mt-0.5">
                  {item.quantity > 1 && (
                    <Text className="text-xs text-muted-foreground">x{item.quantity}</Text>
                  )}
                  {item.is_loan && (
                    <View className="flex-row items-center gap-1">
                      <Ionicons name="swap-horizontal" size={12} color="#8B5CF6" />
                      <Text className="text-xs text-purple-600">Loan</Text>
                    </View>
                  )}
                  {item.instance_date && (
                    <Text className="text-xs text-muted-foreground">
                      {new Date(item.instance_date + 'T00:00:00').toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </Text>
                  )}
                  {item.instance_start_time && (
                    <Text className="text-xs text-muted-foreground">
                      at {item.instance_start_time}
                    </Text>
                  )}
                </View>
              </View>
              <Text className="text-sm font-medium text-foreground">
                {item.total_amount > 0
                  ? formatCurrency(item.total_amount, currency)
                  : 'Free'}
              </Text>
            </View>
          ))}
        </View>

        {/* Total */}
        <View className="flex-row justify-between items-center px-4 py-3 border-t border-primary/20">
          <Text className="text-sm font-bold text-foreground">Total</Text>
          <Text className="text-base font-bold text-primary">
            {totalAmount > 0 ? formatCurrency(totalAmount, currency) : 'Free'}
          </Text>
        </View>
      </View>
    </View>
  );
}
