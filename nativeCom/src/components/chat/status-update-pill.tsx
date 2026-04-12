import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '@/components/ui/text';
import { formatMessageTime } from '@/lib/utils/chat';
import type { ChatMessage } from '@/types/chat';

const STATUS_DISPLAY: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: 'Booking created', color: '#F59E0B', icon: 'time-outline' },
  confirmed: { label: 'Booking confirmed', color: '#3B82F6', icon: 'checkmark-circle-outline' },
  in_progress: { label: 'In progress', color: '#8B5CF6', icon: 'construct-outline' },
  ready: { label: 'Ready', color: '#10B981', icon: 'checkmark-done-circle-outline' },
  completed: { label: 'Booking completed', color: '#059669', icon: 'trophy-outline' },
  cancelled: { label: 'Booking cancelled', color: '#EF4444', icon: 'close-circle-outline' },
  loaned_out: { label: 'Item loaned out', color: '#8B5CF6', icon: 'arrow-forward-circle-outline' },
  returned: { label: 'Item returned', color: '#059669', icon: 'checkmark-done-circle-outline' },
  overdue: { label: 'Overdue', color: '#DC2626', icon: 'alert-circle-outline' },
};

interface Props {
  message: ChatMessage;
}

export function StatusUpdatePill({ message }: Props) {
  const meta = message.metadata as {
    from_status?: string;
    to_status?: string;
  } | null;

  const toStatus = meta?.to_status ?? '';
  const display = STATUS_DISPLAY[toStatus] ?? {
    label: message.content ?? 'Status updated',
    color: '#6B7280',
    icon: 'information-circle-outline',
  };

  return (
    <View className="items-center my-3">
      <View className="flex-row items-center gap-1.5 px-4 py-1.5 rounded-full bg-muted/50">
        <Ionicons name={display.icon as any} size={14} color={display.color} />
        <Text className="text-xs font-medium" style={{ color: display.color }}>
          {display.label}
        </Text>
      </View>
      <Text className="text-[10px] text-muted-foreground mt-0.5">
        {formatMessageTime(message.created_at)}
      </Text>
    </View>
  );
}
