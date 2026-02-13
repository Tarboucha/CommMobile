import { z } from "zod";
import { paginationSchema } from "./pagination";

export const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(5000, "Message too long"),
});

export const messageQuerySchema = paginationSchema.extend({
  before: z.string().optional(),
});

export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type MessageQueryParams = z.infer<typeof messageQuerySchema>;
