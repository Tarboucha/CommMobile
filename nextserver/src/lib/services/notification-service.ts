import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/lib/errors/domain-errors";

// ============================================================================
// Mark notification as read
// ============================================================================

export async function markAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notifications.findFirst({
    where: { id: notificationId, profile_id: userId },
  });

  if (!notification) throw new NotFoundError("Notification");

  return prisma.notifications.update({
    where: { id: notificationId },
    data: { is_read: true, read_at: new Date() },
  });
}

// ============================================================================
// Delete single notification
// ============================================================================

export async function deleteNotification(
  notificationId: string,
  userId: string
) {
  await prisma.notifications.deleteMany({
    where: { id: notificationId, profile_id: userId },
  });
}

// ============================================================================
// Delete all notifications
// ============================================================================

export async function deleteAllNotifications(userId: string) {
  await prisma.notifications.deleteMany({
    where: { profile_id: userId },
  });
}
