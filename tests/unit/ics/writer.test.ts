import { describe, expect, it } from "vitest";
import {
  escapeText,
  foldLine,
  writeCalendar,
  type CalendarEvent,
} from "@/lib/ics/writer";

const BASE_EVENT: CalendarEvent = {
  uid: "bk_01j9x7@bookline",
  sequence: 0,
  start: new Date("2026-08-03T16:00:00Z"),
  end: new Date("2026-08-03T16:30:00Z"),
  summary: "Intro call — Dana Ortiz",
  description: "Invitee: dana@example.com",
  status: "CONFIRMED",
  organizer: { name: "Example Host", email: "host@example.com" },
  attendee: { name: "Dana Ortiz", email: "dana@example.com" },
  dtstamp: new Date("2026-07-01T12:00:00Z"),
};

function ics(overrides: Partial<CalendarEvent> = {}, method?: "REQUEST" | "CANCEL") {
  return writeCalendar({
    prodId: "-//Bookline//EN",
    method,
    events: [{ ...BASE_EVENT, ...overrides }],
  });
}

describe("ics writer", () => {
  it("uses CRLF line endings and terminates the last line", () => {
    const out = ics({}, "REQUEST");
    expect(out.endsWith("\r\n")).toBe(true);
    // No bare LF that is not preceded by CR.
    expect(/[^\r]\n/.test(out)).toBe(false);
    const lines = out.split("\r\n");
    expect(lines[0]).toBe("BEGIN:VCALENDAR");
    expect(lines).toContain("VERSION:2.0");
    expect(lines).toContain("END:VCALENDAR");
  });

  it("formats DTSTART and DTEND as UTC basic form", () => {
    const out = ics({}, "REQUEST");
    expect(out).toContain("DTSTART:20260803T160000Z");
    expect(out).toContain("DTEND:20260803T163000Z");
    expect(out).toContain("DTSTAMP:20260701T120000Z");
  });

  it("passes UID and SEQUENCE through unchanged", () => {
    const out = ics({ uid: "custom@bookline", sequence: 3 }, "REQUEST");
    expect(out).toContain("UID:custom@bookline");
    expect(out).toContain("SEQUENCE:3");
  });

  it("writes METHOD:REQUEST and METHOD:CANCEL", () => {
    expect(ics({}, "REQUEST")).toContain("METHOD:REQUEST");
    const cancel = ics({ status: "CANCELLED", sequence: 1 }, "CANCEL");
    expect(cancel).toContain("METHOD:CANCEL");
    expect(cancel).toContain("STATUS:CANCELLED");
    expect(cancel).toContain("SEQUENCE:1");
  });

  it("escapes TEXT special characters", () => {
    expect(escapeText("a,b;c\\d")).toBe("a\\,b\\;c\\\\d");
    expect(escapeText("line1\nline2")).toBe("line1\\nline2");
    const out = ics({ summary: "Meet, greet; plan\\review\nsoon" });
    expect(out).toContain(
      "SUMMARY:Meet\\, greet\\; plan\\\\review\\nsoon",
    );
  });

  it("folds long lines to 75 octets with space continuation", () => {
    const longSummary = "A".repeat(200);
    const out = ics({ summary: longSummary });
    const encoder = new TextEncoder();
    const physical = out.split("\r\n");
    for (const line of physical) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    // The unfolded SUMMARY reconstructs to the original value.
    const summaryIndex = physical.findIndex((l) => l.startsWith("SUMMARY:"));
    let reconstructed = physical[summaryIndex].slice("SUMMARY:".length);
    let i = summaryIndex + 1;
    while (i < physical.length && physical[i].startsWith(" ")) {
      reconstructed += physical[i].slice(1);
      i += 1;
    }
    expect(reconstructed).toBe(longSummary);
  });

  it("folds multi-byte characters without splitting them", () => {
    const summary = "é".repeat(80);
    const out = foldLine(`SUMMARY:${summary}`);
    const encoder = new TextEncoder();
    for (const line of out.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
      // No lone continuation byte: each line decodes cleanly.
      expect(() => decodeURIComponent(encodeURIComponent(line))).not.toThrow();
    }
  });

  it("writes organizer and attendee with mailto and CN", () => {
    // Unfold before matching: long lines are wrapped with CRLF + space.
    const unfolded = ics({}, "REQUEST").replace(/\r\n /g, "");
    expect(unfolded).toContain(
      "ORGANIZER;CN=Example Host:mailto:host@example.com",
    );
    expect(unfolded).toContain(
      "ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=Dana Ortiz:mailto:dana@example.com",
    );
  });

  it("produces a valid empty feed with no method and no events", () => {
    const out = writeCalendar({
      prodId: "-//Bookline//EN",
      name: "Example Host",
      events: [],
    });
    expect(out).toContain("BEGIN:VCALENDAR");
    expect(out).toContain("X-WR-CALNAME:Example Host");
    expect(out).not.toContain("METHOD:");
    expect(out).not.toContain("BEGIN:VEVENT");
    expect(out.trimEnd().endsWith("END:VCALENDAR")).toBe(true);
  });
});
