/**
 * Expo Push Service
 * Sends push notifications via Expo's official SDK
 * Uses direct PostgreSQL connection (like PgNotifyManager) to bypass RLS
 *
 * NOTE: Requires push_tokens table to be added to the schema
 */

import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { Client } from 'pg';
import { log } from '@/lib/log';

const pushLog = log.child({ component: 'expo-push' });

// Create Expo SDK client
const expo = new Expo();

/**
 * Validate if a token is a valid Expo push token
 */
export function isValidExpoPushToken(token: string): boolean {
  return Expo.isExpoPushToken(token);
}

/**
 * Execute a query using direct PostgreSQL connection
 * This bypasses RLS (same approach as PgNotifyManager)
 */
async function queryDB<T>(query: string, params: unknown[] = []): Promise<T[]> {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    const result = await client.query(query, params);
    return result.rows as T[];
  } finally {
    await client.end();
  }
}

/**
 * Send push notifications to all devices of a user
 */
export async function sendPushToUser(
  profileId: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
  badge?: number
): Promise<void> {
  try {
    // Get all push tokens for this user (direct DB query - bypasses RLS)
    // NOTE: push_tokens table must exist in schema
    const tokens = await queryDB<{ id: string; token: string }>(
      'SELECT id, token FROM push_tokens WHERE profile_id = $1',
      [profileId]
    );

    if (!tokens || tokens.length === 0) {
      pushLog.debug({ profileId }, 'no push tokens found for user');
      return;
    }

    // Filter valid tokens and build messages
    const messages: ExpoPushMessage[] = [];
    const validTokens: { id: string; token: string }[] = [];
    const invalidTokenIds: string[] = [];

    for (const t of tokens) {
      if (isValidExpoPushToken(t.token)) {
        validTokens.push(t);
        messages.push({
          to: t.token,
          title,
          body,
          data: data as Record<string, string>,
          sound: 'default',
          badge,
        });
      } else {
        pushLog.warn({ tokenId: t.id }, 'invalid expo token, marking for removal');
        invalidTokenIds.push(t.id);
      }
    }

    // Remove invalid tokens
    if (invalidTokenIds.length > 0) {
      await queryDB(
        'DELETE FROM push_tokens WHERE id = ANY($1)',
        [invalidTokenIds]
      );
    }

    if (messages.length === 0) {
      pushLog.debug({ profileId }, 'no valid tokens after filtering');
      return;
    }

    pushLog.info({ profileId, deviceCount: messages.length }, 'sending push notifications');

    // Chunk messages (Expo recommends max 100 per request)
    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

        // Process tickets for errors
        const tokensToRemove: string[] = [];
        ticketChunk.forEach((ticket: ExpoPushTicket, index: number) => {
          if (ticket.status === 'error') {
            pushLog.error({
              message: ticket.message,
              errorCode: ticket.details?.error,
            }, 'expo push ticket returned error');

            // Handle invalid tokens - mark for removal
            if (ticket.details?.error === 'DeviceNotRegistered') {
              const invalidToken = validTokens[index];
              pushLog.warn({ tokenId: invalidToken.id }, 'device not registered, removing token');
              tokensToRemove.push(invalidToken.id);
            }
          }
        });

        // Batch remove invalid tokens
        if (tokensToRemove.length > 0) {
          await queryDB(
            'DELETE FROM push_tokens WHERE id = ANY($1)',
            [tokensToRemove]
          );
        }
      } catch (err) {
        pushLog.error({ err }, 'error sending push chunk');
      }
    }

    pushLog.info({ profileId, count: messages.length }, 'push notifications processed');
  } catch (err) {
    pushLog.error({ err, profileId }, 'failed to send push to user');
  }
}

/**
 * Notification messages for each type
 */
export const NOTIFICATION_MESSAGES: Record<string, { title: string; body: string }> = {
  // Booking notifications
  booking_new: {
    title: 'Neue Buchung',
    body: 'Du hast eine neue Buchung erhalten',
  },
  booking_confirmed: {
    title: 'Buchung bestätigt',
    body: 'Deine Buchung wurde bestätigt',
  },
  booking_status_update: {
    title: 'Status Update',
    body: 'Der Status deiner Buchung hat sich geändert',
  },
  booking_ready: {
    title: 'Buchung bereit!',
    body: 'Deine Buchung ist bereit',
  },
  booking_completed: {
    title: 'Buchung abgeschlossen',
    body: 'Deine Buchung wurde abgeschlossen',
  },
  booking_cancelled: {
    title: 'Buchung storniert',
    body: 'Deine Buchung wurde storniert',
  },
  // Payment notifications
  payment_received: {
    title: 'Zahlung erhalten',
    body: 'Deine Zahlung wurde erfolgreich verarbeitet',
  },
  payment_refunded: {
    title: 'Rückerstattung',
    body: 'Deine Zahlung wurde zurückerstattet',
  },
  // Community notifications
  community_invite: {
    title: 'Community Einladung',
    body: 'Du wurdest in eine Community eingeladen',
  },
  community_join_request: {
    title: 'Beitrittsanfrage',
    body: 'Jemand möchte deiner Community beitreten',
  },
  community_member_approved: {
    title: 'Willkommen!',
    body: 'Du wurdest in die Community aufgenommen',
  },
  // Offering notifications
  new_offering: {
    title: 'Neues Angebot',
    body: 'Ein neues Angebot ist verfügbar',
  },
  offering_update: {
    title: 'Angebot aktualisiert',
    body: 'Ein Angebot wurde aktualisiert',
  },
  // Review notifications
  new_review: {
    title: 'Neue Bewertung',
    body: 'Du hast eine neue Bewertung erhalten',
  },
  // System
  system: {
    title: 'Benachrichtigung',
    body: 'Du hast eine neue Nachricht',
  },
};
