import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { isSlotConflict } from "@/lib/bookings/conflict";
import { prisma } from "@/lib/db";

let hostId: string;
let eventTypeId: string;

function bookingData(
  uid: string,
  startIso: string,
  endIso: string,
  status: "confirmed" | "cancelled" = "confirmed",
) {
  return {
    hostId,
    eventTypeId,
    inviteeName: "Test Invitee",
    inviteeEmail: "invitee@example.com",
    inviteeTimezone: "UTC",
    startUtc: new Date(startIso),
    endUtc: new Date(endIso),
    blockStartUtc: new Date(startIso),
    blockEndUtc: new Date(endIso),
    status,
    icsUid: uid,
  };
}

beforeAll(async () => {
  const host = await prisma.host.upsert({
    where: { email: "itest-host@example.com" },
    update: {},
    create: {
      email: "itest-host@example.com",
      passwordHash: "not-a-real-hash",
      name: "Integration Host",
      timezone: "UTC",
      feedToken: `itest-feed-${Date.now()}`,
    },
  });
  hostId = host.id;

  const eventType = await prisma.eventType.upsert({
    where: { slug: "itest-intro" },
    update: {},
    create: {
      hostId,
      name: "Integration Intro",
      slug: "itest-intro",
      durationMin: 60,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      minNoticeMin: 0,
      maxDaysAhead: 365,
      reminderLeadMin: 0,
    },
  });
  eventTypeId = eventType.id;
});

beforeEach(async () => {
  await prisma.booking.deleteMany({ where: { hostId } });
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { hostId } });
  await prisma.$disconnect();
});

describe("booking_no_overlap exclusion constraint", () => {
  it("rejects a second confirmed booking with an overlapping block (23P01)", async () => {
    await prisma.booking.create({
      data: bookingData(
        "ex-a@bookline",
        "2026-09-01T10:00:00Z",
        "2026-09-01T11:00:00Z",
      ),
    });

    let error: unknown;
    try {
      await prisma.booking.create({
        data: bookingData(
          "ex-b@bookline",
          "2026-09-01T10:30:00Z",
          "2026-09-01T11:30:00Z",
        ),
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();
    expect(isSlotConflict(error)).toBe(true);
    const confirmed = await prisma.booking.count({
      where: { hostId, status: "confirmed" },
    });
    expect(confirmed).toBe(1);
  });

  it("allows touching ranges where end equals the next start", async () => {
    await prisma.booking.create({
      data: bookingData(
        "touch-a@bookline",
        "2026-09-01T10:00:00Z",
        "2026-09-01T11:00:00Z",
      ),
    });
    await expect(
      prisma.booking.create({
        data: bookingData(
          "touch-b@bookline",
          "2026-09-01T11:00:00Z",
          "2026-09-01T12:00:00Z",
        ),
      }),
    ).resolves.toBeDefined();

    const confirmed = await prisma.booking.count({
      where: { hostId, status: "confirmed" },
    });
    expect(confirmed).toBe(2);
  });

  it("frees the slot once a conflicting booking is cancelled", async () => {
    const first = await prisma.booking.create({
      data: bookingData(
        "cancel-a@bookline",
        "2026-09-01T10:00:00Z",
        "2026-09-01T11:00:00Z",
      ),
    });
    await prisma.booking.update({
      where: { id: first.id },
      data: { status: "cancelled", cancelledAt: new Date() },
    });

    await expect(
      prisma.booking.create({
        data: bookingData(
          "cancel-b@bookline",
          "2026-09-01T10:30:00Z",
          "2026-09-01T11:30:00Z",
        ),
      }),
    ).resolves.toBeDefined();
  });

  it("lets a booking reschedule onto a range overlapping only its old self", async () => {
    const booking = await prisma.booking.create({
      data: bookingData(
        "resched@bookline",
        "2026-09-01T10:00:00Z",
        "2026-09-01T11:00:00Z",
      ),
    });
    await expect(
      prisma.booking.update({
        where: { id: booking.id },
        data: {
          startUtc: new Date("2026-09-01T10:30:00Z"),
          endUtc: new Date("2026-09-01T11:30:00Z"),
          blockStartUtc: new Date("2026-09-01T10:30:00Z"),
          blockEndUtc: new Date("2026-09-01T11:30:00Z"),
          icsSequence: 1,
        },
      }),
    ).resolves.toBeDefined();
  });
});
