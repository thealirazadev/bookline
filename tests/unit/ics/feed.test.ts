import { describe, expect, it } from "vitest";
import { buildFeedCalendar, type FeedBooking } from "@/lib/ics/feed";

function booking(overrides: Partial<FeedBooking> = {}): FeedBooking {
  return {
    icsUid: "bk_one@bookline",
    icsSequence: 0,
    startUtc: new Date("2026-08-03T16:00:00Z"),
    endUtc: new Date("2026-08-03T16:30:00Z"),
    updatedAt: new Date("2026-07-01T12:00:00Z"),
    eventTypeName: "Intro call",
    inviteeName: "Dana Ortiz",
    inviteeEmail: "dana@example.com",
    ...overrides,
  };
}

// Unfold RFC 5545 continuation lines (CRLF + single leading space).
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

describe("buildFeedCalendar", () => {
  it("produces a valid calendar with no bookings", () => {
    const out = buildFeedCalendar("Example Host", []);
    expect(out).toContain("BEGIN:VCALENDAR");
    expect(out).toContain("PRODID:-//Bookline//Bookline//EN");
    expect(out).toContain("X-WR-CALNAME:Example Host");
    expect(out).not.toContain("BEGIN:VEVENT");
    expect(out.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });

  it("is a published calendar, not an invite: no METHOD, events CONFIRMED", () => {
    const out = buildFeedCalendar("Example Host", [booking()]);
    expect(out).not.toContain("METHOD:");
    expect(out).toContain("STATUS:CONFIRMED");
    // A published feed carries no organizer/attendee RSVP semantics.
    expect(out).not.toContain("ATTENDEE");
    expect(out).not.toContain("ORGANIZER");
  });

  it("maps each booking to a VEVENT with its uid, sequence, and times", () => {
    const out = unfold(
      buildFeedCalendar("Example Host", [
        booking(),
        booking({
          icsUid: "bk_two@bookline",
          icsSequence: 2,
          startUtc: new Date("2026-08-04T09:00:00Z"),
          endUtc: new Date("2026-08-04T09:30:00Z"),
          inviteeName: "Sam Lee",
          inviteeEmail: "sam@example.com",
        }),
      ]),
    );
    expect(out.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(out).toContain("UID:bk_one@bookline");
    expect(out).toContain("UID:bk_two@bookline");
    expect(out).toContain("SEQUENCE:0");
    expect(out).toContain("SEQUENCE:2");
    expect(out).toContain("DTSTART:20260803T160000Z");
    expect(out).toContain("DTEND:20260804T093000Z");
    // DTSTAMP comes from updatedAt, not the event start.
    expect(out).toContain("DTSTAMP:20260701T120000Z");
    expect(out).toContain("SUMMARY:Intro call — Dana Ortiz");
    expect(out).toContain("SUMMARY:Intro call — Sam Lee");
    expect(out).toContain("DESCRIPTION:Invitee: Sam Lee (sam@example.com)");
  });

  it("escapes RFC 5545 TEXT specials in the invitee name", () => {
    const out = unfold(
      buildFeedCalendar("Example Host", [
        booking({ inviteeName: "Ortiz, Dana; the 2nd" }),
      ]),
    );
    expect(out).toContain("SUMMARY:Intro call — Ortiz\\, Dana\\; the 2nd");
    expect(out).toContain(
      "DESCRIPTION:Invitee: Ortiz\\, Dana\\; the 2nd (dana@example.com)",
    );
  });
});
