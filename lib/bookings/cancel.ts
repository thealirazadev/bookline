import { prisma } from "@/lib/db";
import { sendCancellationEmails, type EmailStatus } from "@/lib/email/notifications";
import { env } from "@/lib/env";
import { bookingNotActionable, notFound } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { loadBookingContext } from "@/lib/queries/bookings";
import { manageUrl } from "@/lib/tokens";

export interface CancelResult {
  booking: { id: string; status: string };
  emailStatus: EmailStatus;
}

/**
 * Cancel a confirmed, future booking: mark it cancelled (freeing the slot from
 * the exclusion constraint), bump SEQUENCE, and email both sides a
 * METHOD:CANCEL invite for the same UID.
 */
export async function cancelBooking(
  bookingId: string,
  options: { reason?: string; cancelledBy: "invitee" | "host" },
  now: Date = new Date(),
): Promise<CancelResult> {
  const booking = await loadBookingContext(bookingId);
  if (!booking) throw notFound();
  if (
    booking.status !== "confirmed" ||
    booking.startUtc.getTime() <= now.getTime()
  ) {
    throw bookingNotActionable();
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: {
      status: "cancelled",
      cancelledAt: now,
      cancelReason: options.reason ?? null,
      cancelledBy: options.cancelledBy,
      icsSequence: { increment: 1 },
    },
  });

  const url = manageUrl(env.APP_BASE_URL, booking.id, env.LINK_TOKEN_SECRET);
  const emailStatus = await sendCancellationEmails(
    {
      icsUid: updated.icsUid,
      icsSequence: updated.icsSequence,
      eventTypeName: booking.eventType.name,
      startUtc: booking.startUtc,
      endUtc: booking.endUtc,
      invitee: {
        name: booking.inviteeName,
        email: booking.inviteeEmail,
        timezone: booking.inviteeTimezone,
      },
      host: {
        name: booking.host.name,
        email: booking.host.email,
        timezone: booking.host.timezone,
      },
      manageUrl: url,
    },
    options.reason,
  );

  logger.info({
    event: "booking.cancelled",
    bookingId,
    code: options.cancelledBy === "host" ? "HOST_CANCEL" : undefined,
  });

  return {
    booking: { id: updated.id, status: updated.status },
    emailStatus,
  };
}
