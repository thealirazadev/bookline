import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cancelBooking } from "@/lib/bookings/cancel";
import { prisma } from "@/lib/db";
import { verifyHostCredentials } from "@/lib/host-credentials";

const EMAIL = "itest-auth-host@example.com";
const PASSWORD = "correct-horse-battery";
let hostId: string;
let eventTypeId: string;

beforeAll(async () => {
  const host = await prisma.host.upsert({
    where: { email: EMAIL },
    update: { passwordHash: await bcrypt.hash(PASSWORD, 10) },
    create: {
      email: EMAIL,
      passwordHash: await bcrypt.hash(PASSWORD, 10),
      name: "Auth Host",
      timezone: "UTC",
      feedToken: `itest-auth-${Date.now()}`,
    },
  });
  hostId = host.id;

  const eventType = await prisma.eventType.upsert({
    where: { slug: "itest-auth" },
    update: {},
    create: {
      hostId,
      name: "Auth Intro",
      slug: "itest-auth",
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      minNoticeMin: 0,
      maxDaysAhead: 365,
      reminderLeadMin: 0,
    },
  });
  eventTypeId = eventType.id;
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { hostId } });
  await prisma.$disconnect();
});

describe("host credential verification", () => {
  it("returns the host for correct credentials", async () => {
    const result = await verifyHostCredentials(EMAIL, PASSWORD);
    expect(result).toMatchObject({ id: hostId, email: EMAIL });
  });

  it("rejects a wrong password", async () => {
    expect(await verifyHostCredentials(EMAIL, "wrong")).toBeNull();
  });

  it("rejects an unknown email", async () => {
    expect(
      await verifyHostCredentials("nobody@example.com", PASSWORD),
    ).toBeNull();
  });
});

describe("host-initiated cancellation", () => {
  it("cancels a booking and records the host as the canceller", async () => {
    const now = new Date();
    const start = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const end = new Date(start.getTime() + 30 * 60_000);
    const booking = await prisma.booking.create({
      data: {
        hostId,
        eventTypeId,
        inviteeName: "Auth Invitee",
        inviteeEmail: "auth-invitee@example.com",
        inviteeTimezone: "UTC",
        startUtc: start,
        endUtc: end,
        blockStartUtc: start,
        blockEndUtc: end,
        status: "confirmed",
        icsUid: `${crypto.randomUUID()}@bookline`,
      },
    });

    const result = await cancelBooking(
      booking.id,
      { cancelledBy: "host", reason: "Slot closed" },
      now,
    );
    expect(result.booking.status).toBe("cancelled");

    const row = await prisma.booking.findUniqueOrThrow({
      where: { id: booking.id },
    });
    expect(row.status).toBe("cancelled");
    expect(row.cancelledBy).toBe("host");
    expect(row.cancelReason).toBe("Slot closed");
  });
});
