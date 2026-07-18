import { DateTime } from "luxon";
import { isSlotConflict } from "@/lib/bookings/conflict";
import { prisma } from "@/lib/db";
import { sendRescheduleEmails, type EmailStatus } from "@/lib/email/notifications";
import { env } from "@/lib/env";
import {
  bookingNotActionable,
  notFound,
  slotTaken,
  slotUnavailable,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import {
  buildSlotQuery,
  type BookableEventType,
} from "@/lib/queries/availability";
import { loadBookingContext, toUtcIso } from "@/lib/queries/bookings";
import { slotsForDay } from "@/lib/slots/engine";
import type { BookingContext } from "@/lib/queries/bookings";
import { manageUrl } from "@/lib/tokens";
import type { RescheduleInput } from "@/lib/validation/booking";

export interface RescheduleResult {
  booking: { id: string; startUtc: string; endUtc: string; status: string };
  emailStatus: EmailStatus;
}

function toBookableEventType(booking: BookingContext): BookableEventType {
  return {
    id: booking.eventTypeId,
    hostId: booking.hostId,
    slug: booking.eventType.slug,
    name: booking.eventType.name,
    description: "",
    hostTimezone: booking.host.timezone,
    hostName: booking.host.name,
    hostEmail: booking.host.email,
    config: {
      durationMin: booking.eventType.durationMin,
      bufferBeforeMin: booking.eventType.bufferBeforeMin,
      bufferAfterMin: booking.eventType.bufferAfterMin,
      minNoticeMin: booking.eventType.minNoticeMin,
      maxDaysAhead: booking.eventType.maxDaysAhead,
    },
  };
}

function visitorDate(instant: Date, timezone: string): string {
  return (
    DateTime.fromJSDate(instant, { zone: "utc" })
      .setZone(timezone)
      .toISODate() ?? ""
  );
}

/**
 * Move a confirmed booking to a new instant. Re-runs the engine (excluding this
 * booking's own block so its current slot stays selectable) and the same
 * constraint-guarded update; keeps the UID, increments SEQUENCE, and emails both
 * sides the updated invite.
 */
export async function rescheduleBooking(
  bookingId: string,
  input: RescheduleInput,
  now: Date = new Date(),
): Promise<RescheduleResult> {
  const booking = await loadBookingContext(bookingId);
  if (!booking) throw notFound();
  if (
    booking.status !== "confirmed" ||
    booking.startUtc.getTime() <= now.getTime()
  ) {
    throw bookingNotActionable();
  }

  const eventType = toBookableEventType(booking);
  const startUtc = new Date(input.startUtc);
  const date = visitorDate(startUtc, input.timezone);

  const slotQuery = await buildSlotQuery(eventType, now, bookingId);
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

  let updated;
  try {
    updated = await prisma.$transaction((tx) =>
      tx.booking.update({
        where: { id: bookingId },
        data: {
          startUtc,
          endUtc,
          blockStartUtc,
          blockEndUtc,
          inviteeTimezone: input.timezone,
          icsSequence: { increment: 1 },
        },
      }),
    );
  } catch (error) {
    if (isSlotConflict(error)) {
      const refreshedSlots = slotsForDay(
        await buildSlotQuery(eventType, now, bookingId),
        input.timezone,
        date,
      );
      throw slotTaken(refreshedSlots);
    }
    throw error;
  }

  const url = manageUrl(env.APP_BASE_URL, booking.id, env.LINK_TOKEN_SECRET);
  const emailStatus = await sendRescheduleEmails({
    icsUid: updated.icsUid,
    icsSequence: updated.icsSequence,
    eventTypeName: booking.eventType.name,
    startUtc: updated.startUtc,
    endUtc: updated.endUtc,
    invitee: {
      name: updated.inviteeName,
      email: updated.inviteeEmail,
      timezone: updated.inviteeTimezone,
    },
    host: {
      name: booking.host.name,
      email: booking.host.email,
      timezone: booking.host.timezone,
    },
    manageUrl: url,
  });

  logger.info({ event: "booking.rescheduled", bookingId });

  return {
    booking: {
      id: updated.id,
      startUtc: toUtcIso(updated.startUtc),
      endUtc: toUtcIso(updated.endUtc),
      status: updated.status,
    },
    emailStatus,
  };
}
