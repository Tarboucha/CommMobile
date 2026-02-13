import { z } from "zod";

export const createDirectConversationSchema = z.object({
  other_profile_id: z.string().uuid("Invalid profile ID"),
});

export const conversationsListQuerySchema = z.object({
  type: z.enum(["direct", "booking"]).optional(),
});

export type CreateDirectConversationInput = z.infer<typeof createDirectConversationSchema>;
export type ConversationsListQuery = z.infer<typeof conversationsListQuerySchema>;
