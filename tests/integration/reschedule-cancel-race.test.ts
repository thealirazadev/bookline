import { DateTime } from "luxon";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cancelBooking } from "@/lib/bookings/cancel";
import { rescheduleBooking } from "@/lib/bookings/reschedule";
import { prisma } from "@/lib/db";
import {
  buildSlotQuery,
  getActiveEventType,
} from "@/lib/queries/availability";
import { slotsForDay } from "@/lib/slots/engine";

// Transport is irrelevant to the race; keep the test hermetic and quiet.
vi.mock("@/lib/email/mailer", () => ({ sendMail: vi.fn(async () => true) }));

// Wrap loadBookingContext so a test can fire a real, committed cancel in the
// window after a caller reads the booking status but before it updates. This is
// exactly the interleaving the atomic guard has to reject.
const race = vi.hoisted(() => ({
  armed: false,
  onRead: null as null | ((id: string) => Promise<void>),
}));

vi.mock("@/lib/queries/bookings", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/queries/bookings")>();
  return {
    ...actual,
    loadBookingContext: async (id: string) => {
      const ctx = await actual.loadBookingContext(id);
      if (race.armed && race.onRead) {
        race.armed = false;
        await race.onRead(id);
      }
      return ctx;
    },
  };
});

const SLUG = "itest-race";
const HOST_EMAIL = "itest-race-host@example.com";
let hostId: string;
let eventTypeId: string;

beforeAll(async () => {
  const host = await prisma.host.upsert({
    where: { email: HOST_EMAIL },
    update: {},
    create: {
      email: HOST_EMAIL,
      passwordHash: "not-a-real-hash",
      name: "Race Host",
      timezone: "UTC",
      feedToken: `itest-race-${Date.now()}`,
    },
  });
  hostId = host.id;

  const eventType = await prisma.eventType.upsert({
    where: { slug: SLUG },
    update: {},
    create: {
      hostId,
      name: "Race Intro",
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
  race.armed = false;
  race.onRead = null;
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
      inviteeName: "Race Tester",
      inviteeEmail: "race@example.com",
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

describe("reschedule vs concurrent cancel", () => {
  it("rejects a reschedule when a cancel commits after the status read", async () => {
    const now = new Date();
    const [current, target] = await openSlots(now, 2);
    const id = await createConfirmed(current);

    // The cancel fires inside rescheduleBooking's own status read, so the
    // reschedule proceeds on a stale "confirmed" snapshot and only discovers
    // the cancellation at the guarded update.
    race.onRead = async (bookingId) => {
      await cancelBooking(bookingId, { cancelledBy: "invitee" }, now);
    };
    race.armed = true;

    await expect(
      rescheduleBooking(id, { startUtc: target, timezone: "UTC" }, now),
    ).rejects.toMatchObject({ code: "BOOKING_NOT_ACTIONABLE" });

    // The cancel is the only mutation that took effect: still cancelled, still
    // at its original time, and SEQUENCE bumped exactly once (by the cancel).
    const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("cancelled");
    expect(row.startUtc.toISOString()).toBe(new Date(current).toISOString());
    expect(row.icsSequence).toBe(1);
  });
});

describe("cancel vs concurrent cancel", () => {
  it("lets only one of two interleaved cancels take effect", async () => {
    const now = new Date();
    const [current] = await openSlots(now, 1);
    const id = await createConfirmed(current);

    // A second cancel commits inside the first cancel's status read.
    race.onRead = async (bookingId) => {
      await cancelBooking(bookingId, { cancelledBy: "host" }, now);
    };
    race.armed = true;

    await expect(
      cancelBooking(id, { cancelledBy: "invitee" }, now),
    ).rejects.toMatchObject({ code: "BOOKING_NOT_ACTIONABLE" });

    // The winning (host) cancel applied once; SEQUENCE bumped exactly once.
    const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(row.status).toBe("cancelled");
    expect(row.cancelledBy).toBe("host");
    expect(row.icsSequence).toBe(1);
  });
});
