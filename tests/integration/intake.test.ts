import { DateTime } from "luxon";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createBooking } from "@/lib/bookings/create";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import {
  buildSlotQuery,
  getActiveEventType,
} from "@/lib/queries/availability";
import { loadDashboardBookingDetail } from "@/lib/queries/bookings";
import { slotsForDay } from "@/lib/slots/engine";
import type { OutgoingMail } from "@/lib/email/mailer";

// Capture the .ics attachment the create flow emails so the invite assertion
// runs against the real pipeline, not a hand-built invite.
vi.mock("@/lib/email/mailer", () => ({ sendMail: vi.fn(async () => true) }));
import { sendMail } from "@/lib/email/mailer";

const SLUG = "itest-intake";
const HOST_EMAIL = "itest-intake-host@example.com";
let hostId: string;
let questionIds: Record<string, string>;

beforeAll(async () => {
  const host = await prisma.host.upsert({
    where: { email: HOST_EMAIL },
    update: {},
    create: {
      email: HOST_EMAIL,
      passwordHash: "not-a-real-hash",
      name: "Intake Host",
      timezone: "UTC",
      feedToken: `itest-intake-${Date.now()}`,
    },
  });
  hostId = host.id;

  await prisma.eventType.deleteMany({ where: { slug: SLUG } });
  await prisma.eventType.create({
    data: {
      hostId,
      name: "Intake Intro",
      slug: SLUG,
      durationMin: 30,
      bufferBeforeMin: 0,
      bufferAfterMin: 0,
      minNoticeMin: 0,
      maxDaysAhead: 365,
      reminderLeadMin: 0,
      questions: {
        create: [
          { label: "Full name", type: "short_text", required: true, order: 0, options: [] },
          { label: "What do you want to discuss?", type: "long_text", required: false, order: 1, options: [] },
          {
            label: "Preferred format",
            type: "single_choice",
            required: true,
            order: 2,
            options: ["Video", "Phone"],
          },
        ],
      },
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

  const questions = await prisma.intakeQuestion.findMany({
    where: { eventType: { slug: SLUG } },
  });
  questionIds = Object.fromEntries(questions.map((q) => [q.label, q.id]));
});

beforeEach(async () => {
  await prisma.booking.deleteMany({ where: { hostId } });
  vi.mocked(sendMail).mockClear();
});

afterAll(async () => {
  await prisma.booking.deleteMany({ where: { hostId } });
  await prisma.$disconnect();
});

async function firstOpenSlot(now: Date): Promise<string> {
  const eventType = await getActiveEventType(SLUG);
  if (!eventType) throw new Error("event type missing");
  const query = await buildSlotQuery(eventType, now);
  for (let i = 1; i <= 10; i += 1) {
    const date = DateTime.fromJSDate(now, { zone: "utc" })
      .plus({ days: i })
      .toISODate();
    if (!date) continue;
    const slots = slotsForDay(query, "UTC", date);
    if (slots.length > 0) return slots[0].startUtc;
  }
  throw new Error("no open slot");
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

describe("custom intake questions", () => {
  it("intake-required-answer-missing-rejected", async () => {
    const now = new Date();
    const startUtc = await firstOpenSlot(now);

    let caught: unknown;
    try {
      await createBooking(
        {
          eventType: SLUG,
          startUtc,
          name: "Ada Lovelace",
          email: "ada@example.com",
          timezone: "UTC",
          // Full name and Preferred format are required but omitted.
          answers: {},
        },
        now,
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const apiError = caught as ApiError;
    expect(apiError.code).toBe("VALIDATION_ERROR");
    expect(apiError.fields?.[`answers.${questionIds["Full name"]}`]).toBeDefined();
    expect(
      apiError.fields?.[`answers.${questionIds["Preferred format"]}`],
    ).toBeDefined();

    const count = await prisma.booking.count({ where: { hostId } });
    expect(count).toBe(0);
  });

  it("intake-invalid-choice-rejected", async () => {
    const now = new Date();
    const startUtc = await firstOpenSlot(now);

    let caught: unknown;
    try {
      await createBooking(
        {
          eventType: SLUG,
          startUtc,
          name: "Ada Lovelace",
          email: "ada@example.com",
          timezone: "UTC",
          answers: {
            [questionIds["Full name"]]: "Ada Lovelace",
            [questionIds["Preferred format"]]: "Carrier Pigeon",
          },
        },
        now,
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const apiError = caught as ApiError;
    expect(apiError.code).toBe("VALIDATION_ERROR");
    expect(
      apiError.fields?.[`answers.${questionIds["Preferred format"]}`],
    ).toBeDefined();

    const count = await prisma.booking.count({ where: { hostId } });
    expect(count).toBe(0);
  });

  it("intake-answers-persisted-and-loaded", async () => {
    const now = new Date();
    const startUtc = await firstOpenSlot(now);

    const result = await createBooking(
      {
        eventType: SLUG,
        startUtc,
        name: "Ada Lovelace",
        email: "ada@example.com",
        timezone: "UTC",
        answers: {
          [questionIds["Full name"]]: "Ada Lovelace",
          [questionIds["What do you want to discuss?"]]: "Analytical engines",
          [questionIds["Preferred format"]]: "Video",
          // An unknown key is ignored, not stored.
          "bogus-id": "ignored",
        },
      },
      now,
    );

    const detail = await loadDashboardBookingDetail(result.booking.id, hostId);
    expect(detail).not.toBeNull();
    expect(detail?.answers).toEqual([
      { id: expect.any(String), label: "Full name", value: "Ada Lovelace" },
      {
        id: expect.any(String),
        label: "What do you want to discuss?",
        value: "Analytical engines",
      },
      { id: expect.any(String), label: "Preferred format", value: "Video" },
    ]);
  });

  it("intake-answers-in-generated-ics", async () => {
    const now = new Date();
    const startUtc = await firstOpenSlot(now);

    await createBooking(
      {
        eventType: SLUG,
        startUtc,
        name: "Ada Lovelace",
        email: "ada@example.com",
        timezone: "UTC",
        answers: {
          [questionIds["Full name"]]: "Ada Lovelace",
          [questionIds["Preferred format"]]: "Phone",
        },
      },
      now,
    );

    const invite = lastInvite();
    const description = invite
      .split("\r\n")
      .find((line) => line.startsWith("DESCRIPTION:"));
    expect(description).toBeDefined();
    expect(description).toContain("Full name: Ada Lovelace");
    expect(description).toContain("Preferred format: Phone");
  });
});
