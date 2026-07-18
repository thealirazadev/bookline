import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import type { FeedBooking } from "@/lib/ics/feed";

/** Confirmed bookings for a host's iCal feed, from 30 days ago onward. */
export async function loadFeedBookings(
  hostId: string,
  now: Date = new Date(),
): Promise<FeedBooking[]> {
  const from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const bookings = await prisma.booking.findMany({
    where: { hostId, status: "confirmed", startUtc: { gte: from } },
    orderBy: { startUtc: "asc" },
    include: { eventType: { select: { name: true } } },
  });
  return bookings.map((booking) => ({
    icsUid: booking.icsUid,
    icsSequence: booking.icsSequence,
    startUtc: booking.startUtc,
    endUtc: booking.endUtc,
    updatedAt: booking.updatedAt,
    eventTypeName: booking.eventType.name,
    inviteeName: booking.inviteeName,
    inviteeEmail: booking.inviteeEmail,
  }));
}

export function toUtcIso(instant: Date): string {
  return DateTime.fromJSDate(instant, { zone: "utc" }).toFormat(
    "yyyy-LL-dd'T'HH:mm:ss'Z'",
  );
}

export interface DashboardBooking {
  id: string;
  eventTypeName: string;
  inviteeName: string;
  inviteeEmail: string;
  startUtc: string;
  endUtc: string;
  status: string;
}

function toDashboardBooking(booking: {
  id: string;
  inviteeName: string;
  inviteeEmail: string;
  startUtc: Date;
  endUtc: Date;
  status: string;
  eventType: { name: string };
}): DashboardBooking {
  return {
    id: booking.id,
    eventTypeName: booking.eventType.name,
    inviteeName: booking.inviteeName,
    inviteeEmail: booking.inviteeEmail,
    startUtc: toUtcIso(booking.startUtc),
    endUtc: toUtcIso(booking.endUtc),
    status: booking.status,
  };
}

/** Upcoming (future) and past bookings for the dashboard, host order. */
export async function listDashboardBookings(
  hostId: string,
  now: Date = new Date(),
): Promise<{ upcoming: DashboardBooking[]; past: DashboardBooking[] }> {
  const select = {
    id: true,
    inviteeName: true,
    inviteeEmail: true,
    startUtc: true,
    endUtc: true,
    status: true,
    eventType: { select: { name: true } },
  };

  const [upcoming, past] = await Promise.all([
    prisma.booking.findMany({
      where: { hostId, startUtc: { gte: now } },
      orderBy: { startUtc: "asc" },
      select,
    }),
    prisma.booking.findMany({
      where: { hostId, startUtc: { lt: now } },
      orderBy: { startUtc: "desc" },
      select,
    }),
  ]);

  return {
    upcoming: upcoming.map(toDashboardBooking),
    past: past.map(toDashboardBooking),
  };
}

/** Full booking with the host and event-type context needed to act on it. */
export async function loadBookingContext(bookingId: string) {
  return prisma.booking.findUnique({
    where: { id: bookingId },
    include: {
      eventType: {
        select: {
          name: true,
          slug: true,
          durationMin: true,
          bufferBeforeMin: true,
          bufferAfterMin: true,
          minNoticeMin: true,
          maxDaysAhead: true,
        },
      },
      host: {
        select: { id: true, name: true, email: true, timezone: true },
      },
    },
  });
}

export type BookingContext = NonNullable<
  Awaited<ReturnType<typeof loadBookingContext>>
>;

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
