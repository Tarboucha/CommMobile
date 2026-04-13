import { MessageBubble } from '@/components/pages/community/message-bubble';
import { BookingRequestCard } from './booking-request-card';
import { PriceOfferCard } from './price-offer-card';
import { OfferResponsePill } from './offer-response-pill';
import { StatusUpdatePill } from './status-update-pill';
import type { ChatMessage } from '@/types/chat';

interface Props {
  message: ChatMessage;
  isOwn: boolean;
  bookingId?: string;
  userId: string;
  onCounter?: () => void;
}

/**
 * Routes a chat message to the correct renderer based on message_type.
 * Falls back to the standard text bubble for unrecognized types.
 */
export function ChatMessageRenderer({ message, isOwn, bookingId, userId, onCounter }: Props) {
  const messageType = message.message_type ?? 'text';

  switch (messageType) {
    case 'booking_request':
      return <BookingRequestCard message={message} />;

    case 'price_offer':
      return (
        <PriceOfferCard
          message={message}
          isOwn={isOwn}
          bookingId={bookingId ?? ''}
          userId={userId}
          onCounter={onCounter}
        />
      );

    case 'offer_response':
      return <OfferResponsePill message={message} />;

    case 'status_update':
      return <StatusUpdatePill message={message} />;

    case 'text':
    default:
      return <MessageBubble message={message} isOwn={isOwn} />;
  }
}
