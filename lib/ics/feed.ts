import { writeCalendar } from "./writer";

const PRODID = "-//Bookline//Bookline//EN";

export interface FeedBooking {
  icsUid: string;
  icsSequence: number;
  startUtc: Date;
  endUtc: Date;
  updatedAt: Date;
  eventTypeName: string;
  inviteeName: string;
  inviteeEmail: string;
}

/**
 * Build a subscribable calendar of a host's confirmed bookings. No METHOD: this
 * is a published calendar, not an invite. Cancelled bookings are excluded by the
 * caller so subscribers drop their UIDs on refresh.
 */
export function buildFeedCalendar(
  hostName: string,
  bookings: FeedBooking[],
): string {
  return writeCalendar({
    prodId: PRODID,
    name: hostName,
    events: bookings.map((booking) => ({
      uid: booking.icsUid,
      sequence: booking.icsSequence,
      start: booking.startUtc,
      end: booking.endUtc,
      dtstamp: booking.updatedAt,
      summary: `${booking.eventTypeName} — ${booking.inviteeName}`,
      description: `Invitee: ${booking.inviteeName} (${booking.inviteeEmail})`,
      status: "CONFIRMED",
    })),
  });
}
