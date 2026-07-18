import { DateTime } from "luxon";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createBooking } from "@/lib/bookings/create";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import {
  buildSlotQuery,
  getActiveEventType,
} from "@/lib/queries/availability";
import { slotsForDay } from "@/lib/slots/engine";
import type { CreateBookingInput } from "@/lib/validation/booking";

const SLUG = "itest-concurrency";
const HOST_EMAIL = "itest-concurrency-host@example.com";
let hostId: string;

beforeAll(async () => {
  const host = await prisma.host.upsert({
    where: { email: HOST_EMAIL },
    update: {},
    create: {
      email: HOST_EMAIL,
      passwordHash: "not-a-real-hash",
      name: "Concurrency Host",
      timezone: "UTC",
      feedToken: `itest-conc-${Date.now()}`,
    },
  });
  hostId = host.id;

  await prisma.eventType.upsert({
    where: { slug: SLUG },
    update: {},
    create: {
      hostId,
      name: "Concurrency Intro",
      slug: SLUG,
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      minNoticeMin: 0,
      maxDaysAhead: 365,
      reminderLeadMin: 0,
    },
  });

  await prisma.availabilityRule.deleteMany({ where: { hostId } });
  await prisma.availabilityRule.createMany({
    data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
      hostId,
      weekday,
      startMinute: 9 * 60,
      endMinute: 17 * 60,
    })),
  });
});

beforeEach(async () => {
  await prisma.booking.deleteMany({ where: { hostId } });
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { hostId } });
  await prisma.$disconnect();
});

async function firstOpenSlot(now: Date): Promise<{ date: string; startUtc: string }> {
  const eventType = await getActiveEventType(SLUG);
  if (!eventType) throw new Error("event type missing");
  const query = await buildSlotQuery(eventType, now);
  for (let i = 1; i <= 8; i += 1) {
    const date = DateTime.fromJSDate(now, { zone: "utc" })
      .plus({ days: i })
      .toISODate();
    if (!date) continue;
    const slots = slotsForDay(query, "UTC", date);
    if (slots.length > 0) return { date, startUtc: slots[0].startUtc };
  }
  throw new Error("no open slot found");
}

describe("simultaneous-booking-single-winner", () => {
  it("lets exactly one of two concurrent submissions win", async () => {
    const now = new Date();
    const { startUtc } = await firstOpenSlot(now);

    const input: CreateBookingInput = {
      eventType: SLUG,
      startUtc,
      name: "Race Tester",
      email: "race@example.com",
      timezone: "UTC",
    };

    const results = await Promise.allSettled([
      createBooking(input, now),
      createBooking(input, now),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    const reason = (rejected[0] as PromiseRejectedResult).reason;
    expect(reason).toBeInstanceOf(ApiError);
    expect((reason as ApiError).code).toBe("SLOT_TAKEN");

    const confirmed = await prisma.booking.count({
      where: { hostId, status: "confirmed" },
    });
    expect(confirmed).toBe(1);
  });
});
