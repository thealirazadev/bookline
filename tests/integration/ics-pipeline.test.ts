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
import { createBooking } from "@/lib/bookings/create";
import { rescheduleBooking } from "@/lib/bookings/reschedule";
import { prisma } from "@/lib/db";
import {
  buildSlotQuery,
  getActiveEventType,
} from "@/lib/queries/availability";
import { slotsForDay } from "@/lib/slots/engine";
import type { OutgoingMail } from "@/lib/email/mailer";

// Capture the .ics attachment the flow actually emails, so the assertions run
// against the real create -> reschedule -> cancel pipeline, not a hand-built
// invite.
vi.mock("@/lib/email/mailer", () => ({ sendMail: vi.fn(async () => true) }));
import { sendMail } from "@/lib/email/mailer";

const SLUG = "itest-ics-pipeline";
const HOST_EMAIL = "itest-ics-host@example.com";
let hostId: string;

beforeAll(async () => {
  const host = await prisma.host.upsert({
    where: { email: HOST_EMAIL },
    update: {},
    create: {
      email: HOST_EMAIL,
      passwordHash: "not-a-real-hash",
      name: "ICS Host",
      timezone: "UTC",
      feedToken: `itest-ics-${Date.now()}`,
    },
  });
  hostId = host.id;

  await prisma.eventType.upsert({
    where: { slug: SLUG },
    update: {},
    create: {
      hostId,
      name: "ICS Intro",
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
  vi.mocked(sendMail).mockClear();
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

/** Unfolded .ics of the most recent attachment sent since the last clear. */
function lastInvite(): string {
  const calls = vi.mocked(sendMail).mock.calls;
  for (let i = calls.length - 1; i >= 0; i -= 1) {
    const message = calls[i][0] as OutgoingMail;
    const content = message.attachments?.[0]?.content;
    if (content) return content.replace(/\r\n /g, "");
  }
  throw new Error("no invite attachment captured");
}

function field(ics: string, name: string): string {
  const line = ics.split("\r\n").find((l) => l.startsWith(`${name}:`));
  if (!line) throw new Error(`missing ${name}`);
  return line.slice(name.length + 1);
}

describe("ics pipeline SEQUENCE and METHOD across the booking lifecycle", () => {
  it("keeps one UID while SEQUENCE climbs through reschedules and CANCEL", async () => {
    const now = new Date();
    const [s0, s1, s2] = await openSlots(now, 3);

    const created = await createBooking(
      {
        eventType: SLUG,
        startUtc: s0,
        name: "Pipeline Tester",
        email: "pipeline@example.com",
        timezone: "UTC",
      },
      now,
    );
    const id = created.booking.id;
    const createInvite = lastInvite();
    const uid = field(createInvite, "UID");
    expect(field(createInvite, "METHOD")).toBe("REQUEST");
    expect(field(createInvite, "SEQUENCE")).toBe("0");

    vi.mocked(sendMail).mockClear();
    await rescheduleBooking(id, { startUtc: s1, timezone: "UTC" }, now);
    const r1 = lastInvite();
    expect(field(r1, "METHOD")).toBe("REQUEST");
    expect(field(r1, "SEQUENCE")).toBe("1");
    expect(field(r1, "UID")).toBe(uid);

    vi.mocked(sendMail).mockClear();
    await rescheduleBooking(id, { startUtc: s2, timezone: "UTC" }, now);
    const r2 = lastInvite();
    expect(field(r2, "METHOD")).toBe("REQUEST");
    expect(field(r2, "SEQUENCE")).toBe("2");
    expect(field(r2, "UID")).toBe(uid);

    vi.mocked(sendMail).mockClear();
    await cancelBooking(id, { cancelledBy: "invitee" }, now);
    const cancel = lastInvite();
    expect(field(cancel, "METHOD")).toBe("CANCEL");
    expect(field(cancel, "STATUS")).toBe("CANCELLED");
    expect(field(cancel, "SEQUENCE")).toBe("3");
    expect(field(cancel, "UID")).toBe(uid);

    // The database is the source of truth the invites mirror.
    const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(row.icsSequence).toBe(3);
    expect(`${row.icsUid}`).toBe(uid);
  });
});
