import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError } from "@/lib/errors/domain-errors";

/**
 * Asserts that the message exists and the user is its sender.
 * Returns the message on success.
 */
export async function assertMessageSender(messageId: string, userId: string) {
  const message = await prisma.messages.findFirst({
    where: { id: messageId, is_deleted: false },
    select: { id: true, conversation_id: true, sender_id: true },
  });

  if (!message) throw new NotFoundError("Message");
  if (message.sender_id !== userId) {
    throw new ForbiddenError("You can only attach files to your own messages");
  }

  return message;
}
