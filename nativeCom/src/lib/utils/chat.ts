import type { ChatMessage } from '@/types/chat';

export function getSenderName(sender: ChatMessage['sender']): string {
  if (sender.display_name) return sender.display_name;
  if (sender.first_name) return sender.first_name;
  return sender.id.slice(0, 8);
}

export function formatMessageTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
