/**
 * Benchmarks for the two hot paths: pure slot generation (CPU only) and
 * booking-insert transactions against Postgres (exclusion constraint active).
 *
 * Run against the docker-compose stack:
 *   npm run bench
 *
 * Numbers are only meaningful on the machine that produces them; the script
 * prints its environment so a committed table can state its conditions.
 * The DB section creates and cleans up its own host/event-type/bookings and
 * touches nothing else.
 */
import { performance } from "node:perf_hooks";
import { randomUUID } from "node:crypto";
import { DateTime } from "luxon";
import { daysForMonth, generateSlots, slotsForDay } from "@/lib/slots/engine";
import type { SlotQuery, WeeklyRule } from "@/lib/slots/types";
import type { PrismaClient } from "@prisma/client";

// Load DATABASE_URL before anything imports the Prisma client (lib/db pulls in
// lib/env, which validates the environment at module-eval time). The client is
// therefore imported dynamically inside main(), after this runs.
try {
  process.loadEnvFile(".env");
} catch {
  // No .env; rely on the ambient environment.
}

const BENCH_HOST_EMAIL = "bench-host@bookline.local";
const BENCH_SLUG = "bench-intro";

function businessHours(): WeeklyRule[] {
  // Mon–Fri 09:00–17:00 in the host's zone.
  return [0, 1, 2, 3, 4].map((weekday) => ({
    weekday,
    startMinute: 9 * 60,
    endMinute: 17 * 60,
  }));
}

function baseQuery(hostTimezone: string): SlotQuery {
  return {
    eventType: {
      durationMin: 30,
      bufferBeforeMin: 10,
      bufferAfterMin: 10,
      minNoticeMin: 120,
      maxDaysAhead: 3650,
    },
    hostTimezone,
    rules: businessHours(),
    overrides: [],
    blackouts: [],
    blocks: [],
    now: new Date("2026-01-01T00:00:00Z"),
  };
}

interface Stat {
  label: string;
  iterations: number;
  meanMs: number;
  p50Ms: number;
  opsPerSec: number;
}

function summarize(label: string, samples: number[]): Stat {
  const sorted = [...samples].sort((a, b) => a - b);
  const total = sorted.reduce((s, x) => s + x, 0);
  const mean = total / sorted.length;
  const p50 = sorted[Math.floor(sorted.length / 2)];
  return {
    label,
    iterations: samples.length,
    meanMs: mean,
    p50Ms: p50,
    opsPerSec: 1000 / mean,
  };
}

function timeIt(label: string, iterations: number, fn: () => void): Stat {
  // Warm up the JIT before measuring.
  for (let i = 0; i < Math.min(3, iterations); i += 1) fn();
  const samples: number[] = [];
  for (let i = 0; i < iterations; i += 1) {
    const t0 = performance.now();
    fn();
    samples.push(performance.now() - t0);
  }
  return summarize(label, samples);
}

function benchSlots(): Stat[] {
  const pairs: Array<[string, string, string]> = [
    ["UTC host, UTC visitor", "UTC", "UTC"],
    ["New_York host, Berlin visitor", "America/New_York", "Europe/Berlin"],
    ["Tokyo host, Los_Angeles visitor", "Asia/Tokyo", "America/Los_Angeles"],
    ["Chatham host, Kolkata visitor", "Pacific/Chatham", "Asia/Kolkata"],
  ];

  const stats: Stat[] = [];

  // One month of availability (the /api/availability hot path), per tz pair.
  for (const [label, host, visitor] of pairs) {
    const q = baseQuery(host);
    stats.push(
      timeIt(`daysForMonth — ${label}`, 60, () => {
        daysForMonth(q, visitor, "2026-06");
      }),
    );
  }

  // A single day's slots (the /api/slots hot path).
  {
    const q = baseQuery("America/New_York");
    stats.push(
      timeIt("slotsForDay — New_York host, Berlin visitor", 500, () => {
        slotsForDay(q, "Europe/Berlin", "2026-06-15");
      }),
    );
  }

  // A large range: a full 365 host-local dates in one generateSlots call.
  {
    const q = baseQuery("America/New_York");
    const dates: string[] = [];
    let cursor = DateTime.fromISO("2026-01-01", { zone: "America/New_York" });
    for (let i = 0; i < 365; i += 1) {
      const iso = cursor.toISODate();
      if (iso) dates.push(iso);
      cursor = cursor.plus({ days: 1 });
    }
    stats.push(
      timeIt("generateSlots — 365 host dates, New_York", 30, () => {
        generateSlots(q, dates);
      }),
    );
  }

  return stats;
}

async function benchBookings(
  prisma: PrismaClient,
  count: number,
): Promise<Stat> {
  const host = await prisma.host.upsert({
    where: { email: BENCH_HOST_EMAIL },
    update: {},
    create: {
      email: BENCH_HOST_EMAIL,
      passwordHash: "not-a-real-hash",
      name: "Bench Host",
      timezone: "UTC",
      feedToken: `bench-${randomUUID()}`,
    },
  });
  const eventType = await prisma.eventType.upsert({
    where: { slug: BENCH_SLUG },
    update: {},
    create: {
      hostId: host.id,
      name: "Bench Intro",
      slug: BENCH_SLUG,
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      minNoticeMin: 0,
      maxDaysAhead: 3650,
      reminderLeadMin: 0,
    },
  });

  await prisma.booking.deleteMany({ where: { hostId: host.id } });

  // Each booking takes a distinct, non-overlapping 30-minute slot, so the
  // exclusion constraint is checked on every insert but never trips. This
  // measures the booking transaction against Postgres in isolation — no email,
  // no HTTP, no slot engine.
  const base = new Date("2030-01-01T00:00:00Z").getTime();
  const samples: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = new Date(base + i * 30 * 60_000);
    const end = new Date(start.getTime() + 30 * 60_000);
    const t0 = performance.now();
    await prisma.$transaction((tx) =>
      tx.booking.create({
        data: {
          hostId: host.id,
          eventTypeId: eventType.id,
          inviteeName: "Bench Invitee",
          inviteeEmail: "bench@example.com",
          inviteeTimezone: "UTC",
          startUtc: start,
          endUtc: end,
          blockStartUtc: start,
          blockEndUtc: end,
          status: "confirmed",
          icsUid: `${randomUUID()}@bookline`,
        },
      }),
    );
    samples.push(performance.now() - t0);
  }

  // Leave no trace: bookings first (EventType restricts deletes), then the
  // host, which cascades to its event types.
  await prisma.booking.deleteMany({ where: { hostId: host.id } });
  await prisma.host.delete({ where: { id: host.id } });
  return summarize(`booking insert transaction (n=${count})`, samples);
}

function printTable(title: string, rows: Stat[]): void {
  process.stdout.write(`\n${title}\n`);
  process.stdout.write(
    `${"operation".padEnd(46)} ${"iters".padStart(6)} ${"mean ms".padStart(9)} ${"p50 ms".padStart(9)} ${"ops/sec".padStart(10)}\n`,
  );
  for (const r of rows) {
    process.stdout.write(
      `${r.label.padEnd(46)} ${String(r.iterations).padStart(6)} ${r.meanMs.toFixed(4).padStart(9)} ${r.p50Ms.toFixed(4).padStart(9)} ${r.opsPerSec.toFixed(1).padStart(10)}\n`,
    );
  }
}

async function main(): Promise<void> {
  process.stdout.write(
    `node ${process.version} | ${process.platform} ${process.arch}\n`,
  );

  const slotStats = benchSlots();
  printTable("Slot generation (pure CPU, no I/O)", slotStats);

  const { prisma } = await import("@/lib/db");
  try {
    const bookingStat = await benchBookings(prisma, 500);
    printTable("Booking transaction throughput (Postgres)", [bookingStat]);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
