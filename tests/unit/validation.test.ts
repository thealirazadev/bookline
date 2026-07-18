import { describe, expect, it } from "vitest";
import {
  findWeeklyOverlap,
  findWindowOverlap,
  weeklyRulesSchema,
} from "@/lib/validation/availability";
import { createBookingSchema } from "@/lib/validation/booking";
import { timezoneSchema } from "@/lib/validation/common";
import { eventTypeCreateSchema } from "@/lib/validation/eventType";

describe("weekly rule overlap detection", () => {
  it("flags two overlapping windows on the same weekday", () => {
    expect(
      findWeeklyOverlap([
        { weekday: 0, startMinute: 540, endMinute: 660 },
        { weekday: 0, startMinute: 600, endMinute: 720 },
      ]),
    ).toBe(0);
  });

  it("allows adjacent (touching) windows on the same weekday", () => {
    expect(
      findWeeklyOverlap([
        { weekday: 0, startMinute: 540, endMinute: 660 },
        { weekday: 0, startMinute: 660, endMinute: 720 },
      ]),
    ).toBeNull();
  });

  it("flags a midnight-crossing window overlapping a late window", () => {
    // Friday 22:00-02:00 crosses midnight; 23:00-23:30 sits inside it.
    expect(
      findWeeklyOverlap([
        { weekday: 4, startMinute: 1320, endMinute: 120 },
        { weekday: 4, startMinute: 1380, endMinute: 1410 },
      ]),
    ).toBe(4);
  });

  it("does not flag a crossing window against an unrelated early window", () => {
    // Friday 22:00-02:00 vs Friday 01:00-02:00 (early Friday) do not conflict.
    expect(
      findWeeklyOverlap([
        { weekday: 4, startMinute: 1320, endMinute: 120 },
        { weekday: 4, startMinute: 60, endMinute: 120 },
      ]),
    ).toBeNull();
  });

  it("does not flag overlaps across different weekdays", () => {
    expect(
      findWeeklyOverlap([
        { weekday: 0, startMinute: 540, endMinute: 720 },
        { weekday: 1, startMinute: 540, endMinute: 720 },
      ]),
    ).toBeNull();
  });

  it("detects overlap within a single date's windows", () => {
    expect(
      findWindowOverlap([
        { startMinute: 540, endMinute: 660 },
        { startMinute: 600, endMinute: 720 },
      ]),
    ).toBe(true);
    expect(
      findWindowOverlap([
        { startMinute: 540, endMinute: 600 },
        { startMinute: 600, endMinute: 660 },
      ]),
    ).toBe(false);
  });

  it("parses a valid weekly rule set", () => {
    const result = weeklyRulesSchema.safeParse({
      rules: [{ weekday: 4, startMinute: 1320, endMinute: 120 }],
    });
    expect(result.success).toBe(true);
  });
});

describe("event type bounds", () => {
  const base = {
    name: "Intro",
    slug: "intro",
    durationMin: 30,
    bufferBeforeMin: 0,
    bufferAfterMin: 0,
    minNoticeMin: 0,
    maxDaysAhead: 30,
    reminderLeadMin: 0,
  };

  it("accepts a valid event type", () => {
    expect(eventTypeCreateSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a non-positive duration", () => {
    const result = eventTypeCreateSchema.safeParse({ ...base, durationMin: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a negative buffer", () => {
    const result = eventTypeCreateSchema.safeParse({
      ...base,
      bufferBeforeMin: -1,
    });
    expect(result.success).toBe(false);
  });

  it("rejects a horizon below one day", () => {
    const result = eventTypeCreateSchema.safeParse({ ...base, maxDaysAhead: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a duplicate-invalid slug shape", () => {
    const result = eventTypeCreateSchema.safeParse({
      ...base,
      slug: "Not A Slug",
    });
    expect(result.success).toBe(false);
  });
});

describe("input guards", () => {
  it("rejects an invalid IANA timezone", () => {
    expect(timezoneSchema.safeParse("Mars/Olympus").success).toBe(false);
    expect(timezoneSchema.safeParse("America/New_York").success).toBe(true);
  });

  it("rejects an invalid booking email", () => {
    const result = createBookingSchema.safeParse({
      eventType: "intro-call",
      startUtc: "2026-08-03T16:00:00Z",
      name: "Dana",
      email: "not-an-email",
      timezone: "UTC",
    });
    expect(result.success).toBe(false);
  });
});
