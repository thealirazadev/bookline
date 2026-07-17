import { DateTime } from "luxon";

// Minimal RFC 5545 writer: CRLF line endings, 75-octet folding, TEXT escaping,
// and UTC DTSTART/DTEND. Kept hand-rolled so METHOD, UID, and SEQUENCE are
// exactly controllable across REQUEST / CANCEL and the published feed.

export type CalendarMethod = "REQUEST" | "CANCEL";

export interface CalendarParticipant {
  name: string;
  email: string;
}

export interface CalendarEvent {
  uid: string;
  sequence: number;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
  status?: "CONFIRMED" | "CANCELLED";
  organizer?: CalendarParticipant;
  attendee?: CalendarParticipant;
  dtstamp?: Date;
}

export interface Calendar {
  prodId: string;
  events: CalendarEvent[];
  method?: CalendarMethod;
  name?: string;
}

const MAX_OCTETS = 75;

/** Escape a TEXT value per RFC 5545 (backslash, semicolon, comma, newline). */
export function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/** Fold a content line to 75 octets, continuation lines starting with a space. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = "";
  let currentBytes = 0;
  for (const ch of line) {
    const chBytes = encoder.encode(ch).length;
    if (currentBytes + chBytes > MAX_OCTETS) {
      out.push(current);
      current = ` ${ch}`;
      currentBytes = 1 + chBytes;
    } else {
      current += ch;
      currentBytes += chBytes;
    }
  }
  out.push(current);
  return out.join("\r\n");
}

function formatUtc(date: Date): string {
  return DateTime.fromJSDate(date, { zone: "utc" }).toFormat(
    "yyyyLLdd'T'HHmmss'Z'",
  );
}

/** Sanitize and, if needed, quote a parameter value (params cannot be escaped). */
function paramValue(value: string): string {
  const clean = value.replace(/["\r\n]/g, " ").trim();
  return /[,;:]/.test(clean) ? `"${clean}"` : clean;
}

function participantLine(
  property: "ORGANIZER" | "ATTENDEE",
  participant: CalendarParticipant,
): string {
  const params =
    property === "ATTENDEE"
      ? `;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${paramValue(
          participant.name,
        )}`
      : `;CN=${paramValue(participant.name)}`;
  return `${property}${params}:mailto:${participant.email}`;
}

function eventLines(event: CalendarEvent): string[] {
  const lines: string[] = ["BEGIN:VEVENT"];
  lines.push(`UID:${event.uid}`);
  lines.push(`SEQUENCE:${event.sequence}`);
  lines.push(`DTSTAMP:${formatUtc(event.dtstamp ?? new Date())}`);
  lines.push(`DTSTART:${formatUtc(event.start)}`);
  lines.push(`DTEND:${formatUtc(event.end)}`);
  lines.push(`SUMMARY:${escapeText(event.summary)}`);
  if (event.description !== undefined) {
    lines.push(`DESCRIPTION:${escapeText(event.description)}`);
  }
  if (event.organizer) {
    lines.push(participantLine("ORGANIZER", event.organizer));
  }
  if (event.attendee) {
    lines.push(participantLine("ATTENDEE", event.attendee));
  }
  if (event.status) {
    lines.push(`STATUS:${event.status}`);
  }
  lines.push("END:VEVENT");
  return lines;
}

/** Serialize a calendar to a folded, CRLF-terminated RFC 5545 string. */
export function writeCalendar(calendar: Calendar): string {
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0"];
  lines.push(`PRODID:${calendar.prodId}`);
  lines.push("CALSCALE:GREGORIAN");
  if (calendar.method) {
    lines.push(`METHOD:${calendar.method}`);
  }
  if (calendar.name) {
    lines.push(`X-WR-CALNAME:${escapeText(calendar.name)}`);
  }
  for (const event of calendar.events) {
    lines.push(...eventLines(event));
  }
  lines.push("END:VCALENDAR");
  return lines.map(foldLine).join("\r\n") + "\r\n";
}
