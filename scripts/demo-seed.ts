/**
 * Seed a throwaway demo database with a host, two event types, weekly
 * availability, a date override, a blackout, and a spread of bookings, so the
 * README screenshots in docs/images are captured against realistic content.
 *
 * All names and addresses are synthetic (example.com). This is not the app's
 * normal seed (prisma/seed.ts); it exists only to make the screenshots in
 * docs/images reproducible. Point it at a scratch database, never a real one:
 *
 *   DATABASE_URL=postgresql://bookline:bookline@localhost:5433/bookline_demo \
 *     npx tsx scripts/demo-seed.ts
 *
 * Dates are relative to the day it runs, so re-running always produces a
 * calendar with bookings in the recent past and the near future.
 */
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DateTime } from "luxon";

// Read DATABASE_URL from .env only as a fallback: loadEnvFile never overrides a
// variable already set, so an inline DATABASE_URL still points at the scratch DB.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env; rely on the ambient environment.
}

const HOST_TIMEZONE = "Europe/Berlin";
const HOST_EMAIL = "jordan.avery@example.com";
const HOST_PASSWORD = "demo-password";
const BCRYPT_ROUNDS = 10;

interface EventTypeSeed {
  name: string;
  slug: string;
  description: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
  reminderLeadMin: number;
}

const EVENT_TYPES: EventTypeSeed[] = [
  {
    name: "30 minute intro call",
    slug: "intro-call",
    description:
      "A short call to talk through what you need and whether I'm the right fit.",
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    minNoticeMin: 240,
    maxDaysAhead: 60,
    reminderLeadMin: 60,
  },
  {
    name: "60 minute consultation",
    slug: "consultation",
    description:
      "A working session on a specific problem, with written notes afterwards.",
    durationMin: 60,
    bufferBeforeMin: 0,
    bufferAfterMin: 15,
    minNoticeMin: 720,
    maxDaysAhead: 60,
    reminderLeadMin: 120,
  },
];

/** A booking to create, positioned by business-day offset from today. */
interface BookingSeed {
  slug: string;
  dayOffset: number; // business days from today; negative is the past
  hour: number; // host-local wall clock
  minute: number;
  name: string;
  email: string;
  timezone: string;
  status: "confirmed" | "cancelled";
}

const BOOKINGS: BookingSeed[] = [
  {
    slug: "intro-call",
    dayOffset: -6,
    hour: 11,
    minute: 0,
    name: "Riley Novak",
    email: "riley.novak@example.com",
    timezone: "America/New_York",
    status: "confirmed",
  },
  {
    slug: "consultation",
    dayOffset: -3,
    hour: 14,
    minute: 0,
    name: "Morgan Tate",
    email: "morgan.tate@example.com",
    timezone: "Europe/London",
    status: "confirmed",
  },
  {
    slug: "intro-call",
    dayOffset: -1,
    hour: 15,
    minute: 30,
    name: "Sasha Idris",
    email: "sasha.idris@example.com",
    timezone: "Europe/Berlin",
    status: "cancelled",
  },
  {
    slug: "intro-call",
    dayOffset: 1,
    hour: 9,
    minute: 30,
    name: "Casey Lin",
    email: "casey.lin@example.com",
    timezone: "Asia/Singapore",
    status: "confirmed",
  },
  {
    slug: "consultation",
    dayOffset: 2,
    hour: 13,
    minute: 0,
    name: "Devon Marsh",
    email: "devon.marsh@example.com",
    timezone: "America/Los_Angeles",
    status: "confirmed",
  },
  {
    slug: "intro-call",
    dayOffset: 3,
    hour: 10,
    minute: 0,
    name: "Noor Haddad",
    email: "noor.haddad@example.com",
    timezone: "Asia/Dubai",
    status: "confirmed",
  },
  {
    slug: "intro-call",
    dayOffset: 5,
    hour: 16,
    minute: 0,
    name: "Emery Fontaine",
    email: "emery.fontaine@example.com",
    timezone: "Europe/Paris",
    status: "confirmed",
  },
  {
    slug: "consultation",
    dayOffset: 8,
    hour: 11,
    minute: 0,
    name: "Kai Ortega",
    email: "kai.ortega@example.com",
    timezone: "America/Chicago",
    status: "confirmed",
  },
];

function isWeekend(day: DateTime): boolean {
  return day.weekday > 5;
}

/** The date `offset` business days from today in the host's timezone. */
function businessDay(today: DateTime, offset: number): DateTime {
  const step = offset >= 0 ? 1 : -1;
  let cursor = today;
  let remaining = Math.abs(offset);
  while (remaining > 0 || isWeekend(cursor)) {
    cursor = cursor.plus({ days: step });
    if (!isWeekend(cursor) && remaining > 0) remaining -= 1;
  }
  return cursor;
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const prisma = new PrismaClient();

  try {
    // Start from a clean host so re-runs are idempotent (cascades to everything).
    await prisma.host.deleteMany({ where: { email: HOST_EMAIL } });

    const host = await prisma.host.create({
      data: {
        email: HOST_EMAIL,
        passwordHash: await bcrypt.hash(HOST_PASSWORD, BCRYPT_ROUNDS),
        name: "Jordan Avery",
        timezone: HOST_TIMEZONE,
        feedToken: randomUUID().replace(/-/g, ""),
      },
    });

    const eventTypeIds = new Map<string, string>();
    for (const seed of EVENT_TYPES) {
      const created = await prisma.eventType.create({
        data: { hostId: host.id, active: true, ...seed },
      });
      eventTypeIds.set(seed.slug, created.id);
    }

    // Weekday 0 = Monday .. 6 = Sunday. Monday-Friday, 09:00-17:00 host-local.
    await prisma.availabilityRule.createMany({
      data: [0, 1, 2, 3, 4].map((weekday) => ({
        hostId: host.id,
        weekday,
        startMinute: 9 * 60,
        endMinute: 17 * 60,
      })),
    });

    const today = DateTime.now().setZone(HOST_TIMEZONE).startOf("day");

    // One Saturday morning opened by an override, and one weekday blacked out,
    // so the month grid shows the override and blackout paths working.
    const saturday = today.plus({ days: (6 - today.weekday + 7) % 7 || 7 });
    await prisma.dateOverride.create({
      data: {
        hostId: host.id,
        date: saturday.toISODate() ?? "",
        startMinute: 10 * 60,
        endMinute: 13 * 60,
      },
    });
    await prisma.blackoutDate.create({
      data: { hostId: host.id, date: businessDay(today, 4).toISODate() ?? "" },
    });

    const durations = new Map(
      EVENT_TYPES.map((type) => [type.slug, type] as const),
    );

    for (const seed of BOOKINGS) {
      const config = durations.get(seed.slug);
      const eventTypeId = eventTypeIds.get(seed.slug);
      if (!config || !eventTypeId) continue;

      const start = businessDay(today, seed.dayOffset).set({
        hour: seed.hour,
        minute: seed.minute,
      });
      const startUtc = start.toUTC().toJSDate();
      const endUtc = start.plus({ minutes: config.durationMin }).toUTC().toJSDate();

      await prisma.booking.create({
        data: {
          hostId: host.id,
          eventTypeId,
          inviteeName: seed.name,
          inviteeEmail: seed.email,
          inviteeTimezone: seed.timezone,
          startUtc,
          endUtc,
          blockStartUtc: new Date(
            startUtc.getTime() - config.bufferBeforeMin * 60_000,
          ),
          blockEndUtc: new Date(
            endUtc.getTime() + config.bufferAfterMin * 60_000,
          ),
          status: seed.status,
          icsUid: `${randomUUID()}@bookline`,
          cancelledAt: seed.status === "cancelled" ? new Date() : null,
          cancelledBy: seed.status === "cancelled" ? "invitee" : null,
          cancelReason:
            seed.status === "cancelled" ? "Something came up." : null,
        },
      });
    }

    process.stdout.write(
      JSON.stringify({
        event: "demo-seed.done",
        hostEmail: HOST_EMAIL,
        eventTypes: EVENT_TYPES.length,
        bookings: BOOKINGS.length,
      }) + "\n",
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(
    `demo-seed failed: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
