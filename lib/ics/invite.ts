import { writeCalendar, type CalendarMethod } from "./writer";

const PRODID = "-//Bookline//Bookline//EN";

export interface InviteBooking {
  icsUid: string;
  icsSequence: number;
  startUtc: Date;
  endUtc: Date;
  eventTypeName: string;
  inviteeName: string;
  inviteeEmail: string;
  hostName: string;
  hostEmail: string;
  manageUrl: string;
}

/**
 * Build the .ics body for a booking. METHOD:REQUEST for a new or rescheduled
 * invite, METHOD:CANCEL to withdraw it. The UID is stable across both; the
 * caller supplies the incremented SEQUENCE.
 */
export function buildInviteIcs(
  booking: InviteBooking,
  method: CalendarMethod,
): string {
  const summary = `${booking.eventTypeName} — ${booking.inviteeName}`;
  const description =
    method === "CANCEL"
      ? "This appointment has been cancelled."
      : `Invitee: ${booking.inviteeEmail}\nManage: ${booking.manageUrl}`;

  return writeCalendar({
    prodId: PRODID,
    method,
    events: [
      {
        uid: booking.icsUid,
        sequence: booking.icsSequence,
        start: booking.startUtc,
        end: booking.endUtc,
        summary,
        description,
        status: method === "CANCEL" ? "CANCELLED" : "CONFIRMED",
        organizer: { name: booking.hostName, email: booking.hostEmail },
        attendee: { name: booking.inviteeName, email: booking.inviteeEmail },
        dtstamp: new Date(),
      },
    ],
  });
}
