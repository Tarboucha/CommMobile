import { prisma } from "@/lib/prisma";
import { NotFoundError, ForbiddenError } from "@/lib/errors/domain-errors";

/**
 * Asserts that the offering exists (not deleted) and belongs to the user.
 * Throws NotFoundError or ForbiddenError on failure.
 * Returns the offering record on success.
 */
export async function assertOfferingOwner(offeringId: string, userId: string) {
  const offering = await prisma.offerings.findFirst({
    where: { id: offeringId, deleted_at: null },
  });

  if (!offering) throw new NotFoundError("Offering");
  if (offering.provider_id !== userId) {
    throw new ForbiddenError("You can only manage your own offerings");
  }

  return offering;
}

/**
 * Asserts that a schedule belongs to the offering and the offering belongs to the user.
 * Combines the two common checks (ownership + schedule existence) into one call.
 */
export async function assertScheduleOwner(
  offeringId: string,
  scheduleId: string,
  userId: string
) {
  const offering = await assertOfferingOwner(offeringId, userId);

  const schedule = await prisma.availability_schedules.findFirst({
    where: { id: scheduleId, offering_id: offeringId },
  });

  if (!schedule) throw new NotFoundError("Schedule");

  return { offering, schedule };
}
