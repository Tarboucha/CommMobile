import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { getSenderName, formatMessageTime } from '@/lib/utils/chat';
import type { ChatMessage } from '@/types/chat';

export function MessageBubble({
  message,
  isOwn,
}: {
  message: ChatMessage;
  isOwn: boolean;
}) {
  return (
    <View className={`px-4 mb-2 ${isOwn ? 'items-end' : 'items-start'}`}>
      {!isOwn && (
        <Text className="text-xs text-muted-foreground mb-1 ml-1">
          {getSenderName(message.sender)}
        </Text>
      )}
      <View
        className={`rounded-2xl px-4 py-2 max-w-[80%] ${
          isOwn ? 'bg-primary' : 'bg-card border border-border'
        }`}
      >
        <Text
          className={`text-sm ${
            isOwn ? 'text-primary-foreground' : 'text-foreground'
          }`}
        >
          {message.is_deleted ? 'This message was deleted' : message.content}
        </Text>
      </View>
      <Text className="text-[10px] text-muted-foreground mt-0.5 mx-1">
        {formatMessageTime(message.created_at)}
      </Text>
    </View>
  );
}
