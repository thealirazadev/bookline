import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { prisma } from "@/lib/db";
import { sendMail } from "@/lib/email/mailer";
import { runReminders } from "@/jobs/reminders";

// The claim is the thing under test; mock the transport and count sends.
vi.mock("@/lib/email/mailer", () => ({
  sendMail: vi.fn(async () => true),
}));

const HOST_EMAIL = "itest-reminder-host@example.com";
let hostId: string;
let eventTypeId: string;

beforeAll(async () => {
  const host = await prisma.host.upsert({
    where: { email: HOST_EMAIL },
    update: {},
    create: {
      email: HOST_EMAIL,
      passwordHash: "not-a-real-hash",
      name: "Reminder Host",
      timezone: "UTC",
      feedToken: `itest-reminder-${Date.now()}`,
    },
  });
  hostId = host.id;

  const eventType = await prisma.eventType.upsert({
    where: { slug: "itest-reminder" },
    update: { reminderLeadMin: 60 },
    create: {
      hostId,
      name: "Reminder Intro",
      slug: "itest-reminder",
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      minNoticeMin: 0,
      maxDaysAhead: 365,
      reminderLeadMin: 60,
    },
  });
  eventTypeId = eventType.id;
});

beforeEach(async () => {
  await prisma.booking.deleteMany({ where: { hostId } });
  vi.mocked(sendMail).mockClear();
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { hostId } });
  await prisma.$disconnect();
});

async function createDueBooking(now: Date): Promise<string> {
  const start = new Date(now.getTime() + 30 * 60_000); // within the 60-min lead
  const end = new Date(start.getTime() + 30 * 60_000);
  const booking = await prisma.booking.create({
    data: {
      hostId,
      eventTypeId,
      inviteeName: "Reminder Invitee",
      inviteeEmail: "reminder-invitee@example.com",
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

describe("reminder idempotency", () => {
  it("sends exactly one email when two job runs fire concurrently", async () => {
    const now = new Date();
    const id = await createDueBooking(now);

    await Promise.all([runReminders(now), runReminders(now)]);

    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
    const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(row.reminderSentAt).not.toBeNull();
  });

  it("does not send again on a later run once claimed", async () => {
    const now = new Date();
    await createDueBooking(now);

    await runReminders(now);
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);

    await runReminders(new Date(now.getTime() + 60_000));
    expect(vi.mocked(sendMail)).toHaveBeenCalledTimes(1);
  });

  it("does not resend a reminder a prior process claimed before restart", async () => {
    // A previous process claimed this reminder (reminderSentAt set) and then
    // died before the delivery outcome was known. Because the claim is persisted
    // and this run starts with no in-memory state, a restart must not fire it
    // again: the guarantee is at-most-once, backed by the row and not the loop.
    const now = new Date();
    const id = await createDueBooking(now);
    const claimedAt = new Date(now.getTime() - 5_000);
    await prisma.booking.update({
      where: { id },
      data: { reminderSentAt: claimedAt },
    });

    const sent = await runReminders(now);

    expect(sent).toBe(0);
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
    const row = await prisma.booking.findUniqueOrThrow({ where: { id } });
    expect(row.reminderSentAt?.toISOString()).toBe(claimedAt.toISOString());
  });

  it("never reminds a cancelled booking", async () => {
    const now = new Date();
    const id = await createDueBooking(now);
    await prisma.booking.update({
      where: { id },
      data: { status: "cancelled", cancelledAt: now },
    });

    const sent = await runReminders(now);
    expect(sent).toBe(0);
    expect(vi.mocked(sendMail)).not.toHaveBeenCalled();
  });
});
