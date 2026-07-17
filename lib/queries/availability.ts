import { DateTime } from "luxon";
import { prisma } from "@/lib/db";
import type { EventTypeConfig, SlotQuery } from "@/lib/slots/types";

export interface BookableEventType {
  id: string;
  hostId: string;
  slug: string;
  name: string;
  description: string;
  config: EventTypeConfig;
  hostTimezone: string;
}

/** Load an active (publicly bookable) event type with its host timezone. */
export async function getActiveEventType(
  slug: string,
): Promise<BookableEventType | null> {
  const eventType = await prisma.eventType.findFirst({
    where: { slug, active: true },
    include: { host: { select: { id: true, timezone: true } } },
  });
  if (!eventType) return null;
  return {
    id: eventType.id,
    hostId: eventType.hostId,
    slug: eventType.slug,
    name: eventType.name,
    description: eventType.description,
    hostTimezone: eventType.host.timezone,
    config: {
      durationMin: eventType.durationMin,
      bufferBeforeMin: eventType.bufferBeforeMin,
      bufferAfterMin: eventType.bufferAfterMin,
      minNoticeMin: eventType.minNoticeMin,
      maxDaysAhead: eventType.maxDaysAhead,
    },
  };
}

/**
 * Assemble a pure SlotQuery from stored availability rules, overrides,
 * blackouts, and the confirmed bookings that could block slots in range.
 * `excludeBookingId` drops a booking's own block so a reschedule can reuse its
 * current time.
 */
export async function buildSlotQuery(
  eventType: BookableEventType,
  now: Date,
  excludeBookingId?: string,
): Promise<SlotQuery> {
  const today = DateTime.fromJSDate(now)
    .setZone(eventType.hostTimezone)
    .startOf("day");
  const scanStart = today.minus({ days: 2 }).toJSDate();
  const scanEnd = today
    .plus({ days: eventType.config.maxDaysAhead + 2 })
    .toJSDate();

  const [rules, overrides, blackouts, bookings] = await Promise.all([
    prisma.availabilityRule.findMany({ where: { hostId: eventType.hostId } }),
    prisma.dateOverride.findMany({ where: { hostId: eventType.hostId } }),
    prisma.blackoutDate.findMany({ where: { hostId: eventType.hostId } }),
    prisma.booking.findMany({
      where: {
        hostId: eventType.hostId,
        status: "confirmed",
        blockEndUtc: { gt: scanStart },
        blockStartUtc: { lt: scanEnd },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      },
      select: { blockStartUtc: true, blockEndUtc: true },
    }),
  ]);

  return {
    eventType: eventType.config,
    hostTimezone: eventType.hostTimezone,
    rules: rules.map((r) => ({
      weekday: r.weekday,
      startMinute: r.startMinute,
      endMinute: r.endMinute,
    })),
    overrides: overrides.map((o) => ({
      date: o.date,
      startMinute: o.startMinute,
      endMinute: o.endMinute,
    })),
    blackouts: blackouts.map((b) => ({ date: b.date })),
    blocks: bookings.map((b) => ({
      startUtc: b.blockStartUtc,
      endUtc: b.blockEndUtc,
    })),
    now,
  };
}
