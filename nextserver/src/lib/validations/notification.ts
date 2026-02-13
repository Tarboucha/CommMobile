import { z } from "zod";
import { NotificationTypeValues } from "@/types/notification";
import { paginationSchema } from "@/lib/validations/pagination";

const booleanFromString = z
  .preprocess((value) => {
    if (typeof value === "string") {
      const normalized = value.toLowerCase();
      if (normalized === "true") return true;
      if (normalized === "false") return false;
    }
    return value;
  }, z.boolean());

const NotificationTypeEnum = z.enum(NotificationTypeValues);

export const notificationFilterSchema = paginationSchema.extend({
  is_read: booleanFromString.optional(),
  notification_type: NotificationTypeEnum.optional(),
});

export type NotificationFilterInput = z.infer<typeof notificationFilterSchema>;

export const notificationMarkReadSchema = z.object({
  is_read: z.boolean(),
});

export type NotificationMarkReadInput = z.infer<typeof notificationMarkReadSchema>;
