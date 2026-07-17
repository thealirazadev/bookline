import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { isSlotConflict } from "@/lib/bookings/conflict";
import { prisma } from "@/lib/db";
import { sendConfirmationEmails, type EmailStatus } from "@/lib/email/notifications";
import { env } from "@/lib/env";
import { notFound, slotTaken, slotUnavailable } from "@/lib/errors";
import { logger, redactEmail } from "@/lib/logger";
import {
  buildSlotQuery,
  getActiveEventType,
  type BookableEventType,
} from "@/lib/queries/availability";
import { slotsForDay } from "@/lib/slots/engine";
import type { Slot } from "@/lib/slots/types";
import { manageUrl } from "@/lib/tokens";
import type { CreateBookingInput } from "@/lib/validation/booking";

export interface CreatedBooking {
  id: string;
  eventType: { slug: string; name: string };
  startUtc: string;
  endUtc: string;
  inviteeName: string;
  inviteeTimezone: string;
  status: string;
}

export interface CreateBookingResult {
  booking: CreatedBooking;
  manageUrl: string;
  emailStatus: EmailStatus;
}

function utcIso(instant: Date): string {
  return DateTime.fromJSDate(instant, { zone: "utc" }).toFormat(
    "yyyy-LL-dd'T'HH:mm:ss'Z'",
  );
}

function visitorDate(instant: Date, timezone: string): string {
  return (
    DateTime.fromJSDate(instant, { zone: "utc" })
      .setZone(timezone)
      .toISODate() ?? ""
  );
}

async function refreshedSlotsForDay(
  eventType: BookableEventType,
  timezone: string,
  date: string,
  now: Date,
): Promise<Slot[]> {
  const slotQuery = await buildSlotQuery(eventType, now);
  return slotsForDay(slotQuery, timezone, date);
}

/**
 * Create a confirmed booking. Re-validates the instant against the engine, then
 * inserts inside a transaction where the booking_no_overlap exclusion constraint
 * is the authority: a 23P01 becomes SLOT_TAKEN with refreshed slots for the day.
 */
export async function createBooking(
  input: CreateBookingInput,
  now: Date = new Date(),
): Promise<CreateBookingResult> {
  const eventType = await getActiveEventType(input.eventType);
  if (!eventType) throw notFound();

  const startUtc = new Date(input.startUtc);
  const date = visitorDate(startUtc, input.timezone);

  // Re-validate against availability rules only (notice, horizon, windows).
  // Existing bookings are deliberately excluded here so a slot taken by another
  // booking still reaches the insert and is rejected by the exclusion
  // constraint as SLOT_TAKEN, not misreported as a rule failure.
  const slotQuery = await buildSlotQuery(eventType, now);
  const matchesRules = slotsForDay(
    { ...slotQuery, blocks: [] },
    input.timezone,
    date,
  ).some((slot) => new Date(slot.startUtc).getTime() === startUtc.getTime());
  if (!matchesRules) throw slotUnavailable();

  const { durationMin, bufferBeforeMin, bufferAfterMin } = eventType.config;
  const endUtc = new Date(startUtc.getTime() + durationMin * 60_000);
  const blockStartUtc = new Date(startUtc.getTime() - bufferBeforeMin * 60_000);
  const blockEndUtc = new Date(endUtc.getTime() + bufferAfterMin * 60_000);
  const icsUid = `${randomUUID()}@bookline`;

  let booking;
  try {
    booking = await prisma.$transaction((tx) =>
      tx.booking.create({
        data: {
          hostId: eventType.hostId,
          eventTypeId: eventType.id,
          inviteeName: input.name,
          inviteeEmail: input.email,
          inviteeTimezone: input.timezone,
          startUtc,
          endUtc,
          blockStartUtc,
          blockEndUtc,
          status: "confirmed",
          icsUid,
        },
      }),
    );
  } catch (error) {
    if (isSlotConflict(error)) {
      const refreshedSlots = await refreshedSlotsForDay(
        eventType,
        input.timezone,
        date,
        now,
      );
      throw slotTaken(refreshedSlots);
    }
    throw error;
  }

  const url = manageUrl(env.APP_BASE_URL, booking.id, env.LINK_TOKEN_SECRET);
  const emailStatus = await sendConfirmationEmails({
    icsUid: booking.icsUid,
    icsSequence: booking.icsSequence,
    eventTypeName: eventType.name,
    startUtc: booking.startUtc,
    endUtc: booking.endUtc,
    invitee: {
      name: booking.inviteeName,
      email: booking.inviteeEmail,
      timezone: booking.inviteeTimezone,
    },
    host: {
      name: eventType.hostName,
      email: eventType.hostEmail,
      timezone: eventType.hostTimezone,
    },
    manageUrl: url,
  });

  logger.info({
    event: "booking.created",
    bookingId: booking.id,
    code: emailStatus === "sent" ? undefined : "EMAIL_PENDING",
  });
  if (emailStatus === "pending") {
    logger.warn({
      event: "booking.email_pending",
      bookingId: booking.id,
      to: redactEmail(booking.inviteeEmail),
    });
  }

  return {
    booking: {
      id: booking.id,
      eventType: { slug: eventType.slug, name: eventType.name },
      startUtc: utcIso(booking.startUtc),
      endUtc: utcIso(booking.endUtc),
      inviteeName: booking.inviteeName,
      inviteeTimezone: booking.inviteeTimezone,
      status: booking.status,
    },
    manageUrl: url,
    emailStatus,
  };
}
