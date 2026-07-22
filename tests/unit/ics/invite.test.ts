import { describe, expect, it } from "vitest";
import { buildInviteIcs, type InviteBooking } from "@/lib/ics/invite";

const BASE: InviteBooking = {
  icsUid: "bk_stable_123@bookline",
  icsSequence: 0,
  startUtc: new Date("2026-08-03T16:00:00Z"),
  endUtc: new Date("2026-08-03T16:30:00Z"),
  eventTypeName: "Intro call",
  inviteeName: "Dana Ortiz",
  inviteeEmail: "dana@example.com",
  hostName: "Example Host",
  hostEmail: "host@example.com",
  manageUrl: "https://bookline.test/manage/tok123",
};

function invite(overrides: Partial<InviteBooking>, method: "REQUEST" | "CANCEL") {
  return buildInviteIcs({ ...BASE, ...overrides }, method);
}

/** Collapse RFC 5545 line folding (CRLF + single leading space). */
function unfold(ics: string): string {
  return ics.replace(/\r\n /g, "");
}

describe("buildInviteIcs RFC 5545 compliance", () => {
  it("emits a REQUEST invite with CONFIRMED status and the manage link", () => {
    const out = invite({}, "REQUEST");
    expect(out).toContain("METHOD:REQUEST");
    expect(out).toContain("STATUS:CONFIRMED");
    expect(out).toContain("UID:bk_stable_123@bookline");
    expect(out).toContain("SEQUENCE:0");
    expect(unfold(out)).toContain("SUMMARY:Intro call — Dana Ortiz");
    expect(unfold(out)).toContain("Manage: https://bookline.test/manage/tok123");
    expect(unfold(out)).toContain(
      "ORGANIZER;CN=Example Host:mailto:host@example.com",
    );
  });

  it("emits a CANCEL invite with CANCELLED status and the same UID", () => {
    const out = invite({ icsSequence: 4 }, "CANCEL");
    expect(out).toContain("METHOD:CANCEL");
    expect(out).toContain("STATUS:CANCELLED");
    expect(out).toContain("UID:bk_stable_123@bookline");
    expect(out).toContain("SEQUENCE:4");
    expect(unfold(out)).toContain(
      "DESCRIPTION:This appointment has been cancelled.",
    );
  });

  it("keeps the UID stable while SEQUENCE climbs across a reschedule series", () => {
    // Booking created (0), rescheduled (1, 2), cancelled (3): one UID throughout,
    // strictly increasing SEQUENCE, per RFC 5545 revision semantics.
    const seen = new Set<string>();
    for (const [seq, method] of [
      [0, "REQUEST"],
      [1, "REQUEST"],
      [2, "REQUEST"],
      [3, "CANCEL"],
    ] as const) {
      const out = invite({ icsSequence: seq }, method);
      expect(out).toContain(`SEQUENCE:${seq}`);
      expect(out).toContain("UID:bk_stable_123@bookline");
      seen.add(out.split("\r\n").find((l) => l.startsWith("UID:")) ?? "");
    }
    expect(seen.size).toBe(1);
  });

  it("folds a multi-byte invitee name without splitting a character", () => {
    const inviteeName = "Café ☕ Señor ñoño ".repeat(6).trim();
    const out = invite({ inviteeName }, "REQUEST");
    const encoder = new TextEncoder();

    // Physical lines stay within 75 octets and each decodes cleanly (no split
    // multi-byte sequence produces an invalid line).
    let folded = false;
    for (const line of out.split("\r\n")) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
      if (line.startsWith(" ")) folded = true;
      expect(() => decodeURIComponent(encodeURIComponent(line))).not.toThrow();
    }
    expect(folded).toBe(true);

    // The unfolded SUMMARY reconstructs the original multi-byte value exactly.
    const line = unfold(out)
      .split("\r\n")
      .find((l) => l.startsWith("SUMMARY:"));
    expect(line).toBe(`SUMMARY:Intro call — ${inviteeName}`);
  });
});
