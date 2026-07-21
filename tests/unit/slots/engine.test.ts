import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  daysForMonth,
  generateSlots,
  slotsForDay,
} from "@/lib/slots/engine";
import type { EventTypeConfig, SlotQuery } from "@/lib/slots/types";

const DEFAULT_EVENT: EventTypeConfig = {
  durationMin: 60,
  bufferBeforeMin: 0,
  bufferAfterMin: 0,
  minNoticeMin: 0,
  maxDaysAhead: 3650,
};

function query(overrides: Partial<SlotQuery> = {}): SlotQuery {
  const { eventType, ...rest } = overrides;
  return {
    eventType: { ...DEFAULT_EVENT, ...(eventType ?? {}) },
    hostTimezone: "UTC",
    rules: [],
    overrides: [],
    blackouts: [],
    blocks: [],
    now: new Date("2026-01-01T00:00:00Z"),
    ...rest,
  };
}

function starts(slots: { startUtc: string }[]): string[] {
  return slots.map((s) => s.startUtc);
}

describe("slot engine DST correctness", () => {
  it("dst-spring-forward-skipped-hour", () => {
    // America/New_York, Sunday 2026-03-08, rule 01:00-04:00, 60-min event.
    const slots = generateSlots(
      query({
        hostTimezone: "America/New_York",
        rules: [{ weekday: 6, startMinute: 60, endMinute: 240 }],
      }),
      ["2026-03-08"],
    );

    // 02:00-02:59 does not exist; only 01:00 (EST) and 03:00 (EDT) are produced.
    expect(starts(slots)).toEqual([
      "2026-03-08T06:00:00Z",
      "2026-03-08T07:00:00Z",
    ]);

    // Every returned instant round-trips to the wall time it claims.
    for (const slot of slots) {
      const local = DateTime.fromISO(slot.startUtc, { zone: "utc" }).setZone(
        "America/New_York",
      );
      const round = DateTime.fromObject(
        {
          year: local.year,
          month: local.month,
          day: local.day,
          hour: local.hour,
          minute: local.minute,
        },
        { zone: "America/New_York" },
      );
      expect(round.toUTC().toISO()).toBe(
        DateTime.fromISO(slot.startUtc, { zone: "utc" }).toISO(),
      );
    }
  });

  it("dst-fall-back-repeated-hour", () => {
    // America/New_York, Sunday 2026-11-01, rule 00:30-03:30, 30-min event.
    const slots = generateSlots(
      query({
        hostTimezone: "America/New_York",
        eventType: { ...DEFAULT_EVENT, durationMin: 30 },
        rules: [{ weekday: 6, startMinute: 30, endMinute: 210 }],
      }),
      ["2026-11-01"],
    );

    // Six slots (00:30 through 03:00); repeated 01:00-01:59 wall hour resolves to
    // the earlier offset exactly once, so no duplicate UTC instants.
    expect(starts(slots)).toEqual([
      "2026-11-01T04:30:00Z",
      "2026-11-01T05:00:00Z",
      "2026-11-01T05:30:00Z",
      "2026-11-01T07:00:00Z",
      "2026-11-01T07:30:00Z",
      "2026-11-01T08:00:00Z",
    ]);
    expect(new Set(starts(slots)).size).toBe(6);
  });

  it("dst-mismatched-transition-windows", () => {
    // Europe/Berlin host (still CET), America/Los_Angeles visitor (already PDT),
    // 2026-03-17: the rendered offset is 8 hours, not the usual 9.
    const slots = slotsForDay(
      query({
        hostTimezone: "Europe/Berlin",
        rules: [{ weekday: 1, startMinute: 540, endMinute: 720 }],
      }),
      "America/Los_Angeles",
      "2026-03-17",
    );

    expect(starts(slots)).toEqual([
      "2026-03-17T08:00:00Z",
      "2026-03-17T09:00:00Z",
      "2026-03-17T10:00:00Z",
    ]);

    // 09:00 Berlin renders as 01:00 Los Angeles (8-hour gap), not 00:00.
    const firstLa = DateTime.fromISO(slots[0].startUtc, { zone: "utc" }).setZone(
      "America/Los_Angeles",
    );
    expect(firstLa.toFormat("HH:mm")).toBe("01:00");
  });

  it("midnight-crossing-window", () => {
    // Asia/Karachi, Friday 2026-08-07, rule 22:00-02:00, 60-min event.
    const slots = generateSlots(
      query({
        hostTimezone: "Asia/Karachi",
        rules: [{ weekday: 4, startMinute: 1320, endMinute: 120 }],
      }),
      ["2026-08-06", "2026-08-07", "2026-08-08"],
    );

    // Starts 22:00, 23:00 (Fri) and 00:00, 01:00 (Sat), all from Friday's window.
    expect(starts(slots)).toEqual([
      "2026-08-07T17:00:00Z",
      "2026-08-07T18:00:00Z",
      "2026-08-07T19:00:00Z",
      "2026-08-07T20:00:00Z",
    ]);

    // A visitor in Los Angeles buckets the later two onto the previous local day.
    const day = slotsForDay(
      query({
        hostTimezone: "Asia/Karachi",
        rules: [{ weekday: 4, startMinute: 1320, endMinute: 120 }],
      }),
      "America/Los_Angeles",
      "2026-08-07",
    );
    expect(day.length).toBeGreaterThan(0);
    for (const slot of day) {
      expect(
        DateTime.fromISO(slot.startUtc, { zone: "utc" })
          .setZone("America/Los_Angeles")
          .toISODate(),
      ).toBe("2026-08-07");
    }
  });
});

describe("slot engine rules and filters", () => {
  it("override replaces weekly rules for its date", () => {
    const slots = generateSlots(
      query({
        rules: [{ weekday: 0, startMinute: 540, endMinute: 600 }],
        overrides: [
          { date: "2026-08-10", startMinute: 840, endMinute: 900 },
        ],
      }),
      ["2026-08-10"],
    );
    expect(starts(slots)).toEqual(["2026-08-10T14:00:00Z"]);
  });

  it("blackout beats rules and overrides", () => {
    const slots = generateSlots(
      query({
        rules: [{ weekday: 0, startMinute: 540, endMinute: 600 }],
        overrides: [{ date: "2026-08-10", startMinute: 840, endMinute: 900 }],
        blackouts: [{ date: "2026-08-10" }],
      }),
      ["2026-08-10"],
    );
    expect(slots).toEqual([]);
  });

  it("minimum notice trims slots inside the notice window today", () => {
    const slots = generateSlots(
      query({
        eventType: { ...DEFAULT_EVENT, durationMin: 30, minNoticeMin: 60 },
        rules: [{ weekday: 0, startMinute: 540, endMinute: 720 }],
        now: new Date("2026-08-10T09:15:00Z"),
      }),
      ["2026-08-10"],
    );
    // Cutoff is 10:15Z, so 09:00/09:30/10:00 drop and 10:30 is first.
    expect(starts(slots)[0]).toBe("2026-08-10T10:30:00Z");
    expect(starts(slots)).not.toContain("2026-08-10T09:00:00Z");
    expect(starts(slots)).not.toContain("2026-08-10T10:00:00Z");
  });

  it("horizon cuts off dates beyond max days ahead", () => {
    const slots = generateSlots(
      query({
        eventType: { ...DEFAULT_EVENT, maxDaysAhead: 2 },
        rules: [
          { weekday: 0, startMinute: 540, endMinute: 600 },
          { weekday: 1, startMinute: 540, endMinute: 600 },
          { weekday: 2, startMinute: 540, endMinute: 600 },
          { weekday: 3, startMinute: 540, endMinute: 600 },
          { weekday: 4, startMinute: 540, endMinute: 600 },
        ],
        now: new Date("2026-08-10T00:00:00Z"),
      }),
      ["2026-08-12", "2026-08-13"],
    );
    // Today (host-local) is 2026-08-10; horizon is +2 days = 2026-08-12.
    expect(starts(slots)).toContain("2026-08-12T09:00:00Z");
    expect(starts(slots)).not.toContain("2026-08-13T09:00:00Z");
  });

  it("buffers block adjacent candidates but allow touching ranges", () => {
    // Booking 10:00-10:30 with 15-min buffers occupies [09:45, 10:45).
    const slots = generateSlots(
      query({
        eventType: {
          ...DEFAULT_EVENT,
          durationMin: 30,
          bufferBeforeMin: 15,
          bufferAfterMin: 15,
        },
        rules: [{ weekday: 0, startMinute: 540, endMinute: 720 }],
        blocks: [
          {
            startUtc: new Date("2026-08-10T09:45:00Z"),
            endUtc: new Date("2026-08-10T10:45:00Z"),
          },
        ],
      }),
      ["2026-08-10"],
    );
    expect(starts(slots)).toEqual([
      "2026-08-10T09:00:00Z", // touches booked block at 09:45, allowed
      "2026-08-10T11:00:00Z", // touches booked block at 10:45, allowed
      "2026-08-10T11:30:00Z",
    ]);
  });

  it("empty rules produce empty output", () => {
    const slots = generateSlots(query(), ["2026-08-10", "2026-08-11"]);
    expect(slots).toEqual([]);
  });

  it(
    "returns no slots for a zero or negative duration without hanging",
    () => {
      // A non-positive duration must not send windowStarts into an infinite
      // loop; a short timeout fails the test if the guard is ever removed.
      const zero = generateSlots(
        query({
          eventType: { ...DEFAULT_EVENT, durationMin: 0 },
          rules: [{ weekday: 0, startMinute: 540, endMinute: 600 }],
        }),
        ["2026-08-10"],
      );
      expect(zero).toEqual([]);

      const negative = generateSlots(
        query({
          eventType: { ...DEFAULT_EVENT, durationMin: -30 },
          rules: [{ weekday: 0, startMinute: 540, endMinute: 600 }],
        }),
        ["2026-08-10"],
      );
      expect(negative).toEqual([]);
    },
    1000,
  );

  it("visitor date maps to two host dates across the dateline", () => {
    // Asia/Tokyo host (UTC+9), America/Los_Angeles visitor (UTC-7). Tokyo
    // 09:00 on 2026-08-11 is 2026-08-10 17:00 in Los Angeles.
    const slots = slotsForDay(
      query({
        hostTimezone: "Asia/Tokyo",
        eventType: { ...DEFAULT_EVENT, durationMin: 60 },
        rules: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
          weekday,
          startMinute: 540,
          endMinute: 600,
        })),
      }),
      "America/Los_Angeles",
      "2026-08-10",
    );
    expect(starts(slots)).toContain("2026-08-11T00:00:00Z");
    const hostDate = DateTime.fromISO("2026-08-11T00:00:00Z", { zone: "utc" })
      .setZone("Asia/Tokyo")
      .toISODate();
    expect(hostDate).toBe("2026-08-11");
  });

  it("daysForMonth marks only days that have open slots", () => {
    const days = daysForMonth(
      query({
        rules: [{ weekday: 0, startMinute: 540, endMinute: 600 }],
        now: new Date("2026-07-01T00:00:00Z"),
      }),
      "UTC",
      "2026-08",
    );
    expect(days).toHaveLength(31);
    const mondays = days.filter((d) => d.hasSlots).map((d) => d.date);
    // August 2026 Mondays: 3, 10, 17, 24, 31.
    expect(mondays).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
  });
});
