/**
 * Expo Push Service
 * Sends push notifications via Expo's official SDK
 * Uses direct PostgreSQL connection (like PgNotifyManager) to bypass RLS
 *
 * NOTE: Requires push_tokens table to be added to the schema
 */

import Expo, { ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { Client } from 'pg';

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
      console.log(`[ExpoPush] No push tokens found for user ${profileId}`);
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
        console.warn(`[ExpoPush] Invalid token found: ${t.token}, marking for removal`);
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
      console.log(`[ExpoPush] No valid tokens for user ${profileId}`);
      return;
    }

    console.log(`[ExpoPush] Sending to ${messages.length} device(s) for user ${profileId}`);

    // Chunk messages (Expo recommends max 100 per request)
    const chunks = expo.chunkPushNotifications(messages);

    for (const chunk of chunks) {
      try {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);

        // Process tickets for errors
        const tokensToRemove: string[] = [];
        ticketChunk.forEach((ticket: ExpoPushTicket, index: number) => {
          if (ticket.status === 'error') {
            console.error(`[ExpoPush] Error for token:`, ticket.message);

            // Handle invalid tokens - mark for removal
            if (ticket.details?.error === 'DeviceNotRegistered') {
              const invalidToken = validTokens[index];
              console.log(`[ExpoPush] Marking for removal: ${invalidToken.token}`);
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
      } catch (chunkError) {
        console.error('[ExpoPush] Error sending chunk:', chunkError);
      }
    }

    console.log(`[ExpoPush] Successfully processed ${messages.length} notification(s)`);
  } catch (error) {
    console.error('[ExpoPush] Failed to send push to user:', error);
  }
}

/**
 * Notification messages for each type
 */
export const NOTIFICATION_MESSAGES: Record<string, { title: string; body: string }> = {
  // Booking notifications
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
