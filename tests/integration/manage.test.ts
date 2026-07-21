import { DateTime } from "luxon";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { cancelBooking } from "@/lib/bookings/cancel";
import { rescheduleBooking } from "@/lib/bookings/reschedule";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import {
  buildSlotQuery,
  getActiveEventType,
} from "@/lib/queries/availability";
import { slotsForDay } from "@/lib/slots/engine";

const SLUG = "itest-manage";
const HOST_EMAIL = "itest-manage-host@example.com";
let hostId: string;
let eventTypeId: string;

beforeAll(async () => {
  const host = await prisma.host.upsert({
    where: { email: HOST_EMAIL },
    update: {},
    create: {
      email: HOST_EMAIL,
      passwordHash: "not-a-real-hash",
      name: "Manage Host",
      timezone: "UTC",
      feedToken: `itest-manage-${Date.now()}`,
    },
  });
  hostId = host.id;

  const eventType = await prisma.eventType.upsert({
    where: { slug: SLUG },
    update: {},
    create: {
      hostId,
      name: "Manage Intro",
      slug: SLUG,
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      minNoticeMin: 0,
      maxDaysAhead: 365,
      reminderLeadMin: 0,
    },
  });
  eventTypeId = eventType.id;

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

async function openSlots(now: Date, count: number): Promise<string[]> {
  const eventType = await getActiveEventType(SLUG);
  if (!eventType) throw new Error("event type missing");
  const query = await buildSlotQuery(eventType, now);
  const found: string[] = [];
  for (let i = 1; i <= 10 && found.length < count; i += 1) {
    const date = DateTime.fromJSDate(now, { zone: "utc" })
      .plus({ days: i })
      .toISODate();
    if (!date) continue;
    for (const slot of slotsForDay(query, "UTC", date)) {
      found.push(slot.startUtc);
      if (found.length >= count) break;
    }
  }
  if (found.length < count) throw new Error("not enough open slots");
  return found;
}

async function createConfirmed(startIso: string): Promise<string> {
  const start = new Date(startIso);
  const end = new Date(start.getTime() + 30 * 60_000);
  const booking = await prisma.booking.create({
    data: {
      hostId,
      eventTypeId,
      inviteeName: "Manage Tester",
      inviteeEmail: "manage@example.com",
      inviteeTimezone: "UTC",
      startUtc: start,
      endUtc: end,
      blockStartUtc: start,
      blockEndUtc: end,
      status: "confirmed",
      icsUid: `${crypto.randomUUID()}@bookline`,
    },
  });
  return booking.id;
}

describe("cancel path", () => {
  it("cancels a confirmed booking, bumps sequence, and frees the slot", async () => {
    const now = new Date();
    const [slot] = await openSlots(now, 1);
    const id = await createConfirmed(slot);

    const result = await cancelBooking(id, { cancelledBy: "invitee" }, now);
    expect(result.booking.status).toBe("cancelled");

    const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("cancelled");
    expect(row.icsSequence).toBe(1);
    expect(row.cancelledBy).toBe("invitee");

    // Slot is free again: another confirmed booking on the same range succeeds.
    await expect(createConfirmed(slot)).resolves.toBeDefined();
  });

  it("refuses to cancel an already-cancelled booking", async () => {
    const now = new Date();
    const [slot] = await openSlots(now, 1);
    const id = await createConfirmed(slot);
    await cancelBooking(id, { cancelledBy: "invitee" }, now);

    await expect(
      cancelBooking(id, { cancelledBy: "invitee" }, now),
    ).rejects.toMatchObject({ code: "BOOKING_NOT_ACTIONABLE" });
  });
});

describe("reschedule path", () => {
  it("moves a booking, keeps the UID, and increments SEQUENCE", async () => {
    const now = new Date();
    const [first, second] = await openSlots(now, 2);
    const id = await createConfirmed(first);
    const before = await prisma.booking.findUniqueOrThrow({ where: { id } });

    const result = await rescheduleBooking(
      id,
      { startUtc: second, timezone: "UTC" },
      now,
    );
    expect(result.booking.startUtc).toBe(second);

    const after = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(after.icsUid).toBe(before.icsUid);
    expect(after.icsSequence).toBe(before.icsSequence + 1);
    expect(after.startUtc.toISOString()).toBe(new Date(second).toISOString());
  });

  it("allows rescheduling onto the booking's own current time", async () => {
    const now = new Date();
    const [slot] = await openSlots(now, 1);
    const id = await createConfirmed(slot);

    await expect(
      rescheduleBooking(id, { startUtc: slot, timezone: "UTC" }, now),
    ).resolves.toMatchObject({ booking: { status: "confirmed" } });
  });

  it("rejects rescheduling a cancelled booking", async () => {
    const now = new Date();
    const [slot, other] = await openSlots(now, 2);
    const id = await createConfirmed(slot);
    await cancelBooking(id, { cancelledBy: "invitee" }, now);

    await expect(
      rescheduleBooking(id, { startUtc: other, timezone: "UTC" }, now),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("rejects a reschedule onto another confirmed booking (SLOT_TAKEN)", async () => {
    // The exclusion constraint, not the application pre-check, must be the
    // authority when a reschedule lands on a slot a different booking holds.
    const now = new Date();
    const [first, second] = await openSlots(now, 2);
    const moving = await createConfirmed(first);
    await createConfirmed(second);

    await expect(
      rescheduleBooking(moving, { startUtc: second, timezone: "UTC" }, now),
    ).rejects.toMatchObject({ code: "SLOT_TAKEN" });

    // The moving booking stays put; the constraint refused the overlap.
    const row = await prisma.booking.findUniqueOrThrow({ where: { id: moving } });
    expect(row.startUtc.toISOString()).toBe(new Date(first).toISOString());
  });
});
