import { DateTime } from "luxon";
import { prisma } from "@/lib/db";

export function toUtcIso(instant: Date): string {
  return DateTime.fromJSDate(instant, { zone: "utc" }).toFormat(
    "yyyy-LL-dd'T'HH:mm:ss'Z'",
  );
}

export interface ManageBookingView {
  booking: {
    id: string;
    eventType: { slug: string; name: string; durationMin: number };
    startUtc: string;
    endUtc: string;
    inviteeName: string;
    inviteeTimezone: string;
    status: string;
  };
  actions: { cancellable: boolean; reschedulable: boolean };
}

/** Manage-page view of a booking, with actions derived from status and time. */
export async function getManageBookingView(
  bookingId: string,
  now: Date = new Date(),
): Promise<ManageBookingView | null> {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      eventType: { select: { slug: true, name: true, durationMin: true } },
    },
  });
  if (!booking) return null;

  const actionable =
    booking.status === "confirmed" && booking.startUtc.getTime() > now.getTime();

  return {
    booking: {
      id: booking.id,
      eventType: {
        slug: booking.eventType.slug,
        name: booking.eventType.name,
        durationMin: booking.eventType.durationMin,
      },
      startUtc: toUtcIso(booking.startUtc),
      endUtc: toUtcIso(booking.endUtc),
      inviteeName: booking.inviteeName,
      inviteeTimezone: booking.inviteeTimezone,
      status: booking.status,
    },
    actions: { cancellable: actionable, reschedulable: actionable },
  };
}
