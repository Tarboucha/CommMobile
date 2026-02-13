import { z } from "zod";
import { NotificationTypeValues } from "@/types/notification";

const booleanFromString = z
  .preprocess((value) => {
    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    return value;
  }, z.boolean());

const numberFromString = z
  .preprocess((value) => {
    if (typeof value === "string") {
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) return parsed;
    }
    return value;
  }, z.number());

const NotificationTypeEnum = z.enum(NotificationTypeValues);

export const notificationFilterSchema = z.object({
  is_read: booleanFromString.optional(),
  notification_type: NotificationTypeEnum.optional(),
  limit: numberFromString.optional().default(20).transform((value) =>
    Math.min(Math.max(value, 1), 100)
  ),
  after: z.string().optional(),
});

export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;

export const notificationMarkReadSchema = z.object({
  is_read: z.boolean(),
});

export type NotificationMarkReadInput = z.infer<typeof notificationMarkReadSchema>;
