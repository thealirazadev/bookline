import { DateTime } from "luxon";

export interface BookingEmailData {
  eventTypeName: string;
  inviteeName: string;
  inviteeEmail: string;
  hostName: string;
  startUtc: Date;
  endUtc: Date;
  manageUrl: string;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

export type Audience = "invitee" | "host";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatWhen(instant: Date, timezone: string): string {
  return DateTime.fromJSDate(instant, { zone: "utc" })
    .setZone(timezone)
    .toFormat("cccc, LLLL d, yyyy 'at' h:mm a (ZZZZ)");
}

function shortDate(instant: Date, timezone: string): string {
  return DateTime.fromJSDate(instant, { zone: "utc" })
    .setZone(timezone)
    .toFormat("LLL d");
}

interface Composition {
  subject: string;
  lines: string[];
  manageUrl?: string;
  manageLabel?: string;
}

function compose({
  subject,
  lines,
  manageUrl,
  manageLabel,
}: Composition): RenderedEmail {
  const textLines = [...lines];
  if (manageUrl) {
    textLines.push("", `${manageLabel ?? "Manage this booking"}: ${manageUrl}`);
  }
  const htmlBody = lines
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");
  const htmlManage = manageUrl
    ? `<p><a href="${escapeHtml(manageUrl)}">${escapeHtml(
        manageLabel ?? "Manage this booking",
      )}</a></p>`
    : "";
  return {
    subject,
    text: textLines.join("\n"),
    html: `${htmlBody}\n${htmlManage}`.trim(),
  };
}

export function confirmationEmail(
  data: BookingEmailData,
  timezone: string,
  audience: Audience,
): RenderedEmail {
  const when = formatWhen(data.startUtc, timezone);
  if (audience === "host") {
    return compose({
      subject: `New booking: ${data.eventTypeName} — ${data.inviteeName}`,
      lines: [
        `${data.inviteeName} (${data.inviteeEmail}) booked ${data.eventTypeName}.`,
        `When: ${when}`,
      ],
    });
  }
  return compose({
    subject: `Confirmed: ${data.eventTypeName} on ${shortDate(
      data.startUtc,
      timezone,
    )}`,
    lines: [
      `Hi ${data.inviteeName},`,
      `Your ${data.eventTypeName} is confirmed for ${when}.`,
    ],
    manageUrl: data.manageUrl,
    manageLabel: "Cancel or reschedule",
  });
}

export function cancellationEmail(
  data: BookingEmailData,
  timezone: string,
  audience: Audience,
  reason?: string,
): RenderedEmail {
  const when = formatWhen(data.startUtc, timezone);
  const reasonLine = reason ? `Reason: ${reason}` : null;
  if (audience === "host") {
    return compose({
      subject: `Cancelled: ${data.eventTypeName} — ${data.inviteeName}`,
      lines: [
        `${data.inviteeName}'s ${data.eventTypeName} on ${when} has been cancelled.`,
        ...(reasonLine ? [reasonLine] : []),
      ],
    });
  }
  return compose({
    subject: `Cancelled: ${data.eventTypeName} on ${shortDate(
      data.startUtc,
      timezone,
    )}`,
    lines: [
      `Hi ${data.inviteeName},`,
      `Your ${data.eventTypeName} on ${when} has been cancelled.`,
      ...(reasonLine ? [reasonLine] : []),
    ],
  });
}

export function rescheduleEmail(
  data: BookingEmailData,
  timezone: string,
  audience: Audience,
): RenderedEmail {
  const when = formatWhen(data.startUtc, timezone);
  if (audience === "host") {
    return compose({
      subject: `Rescheduled: ${data.eventTypeName} — ${data.inviteeName}`,
      lines: [
        `${data.inviteeName}'s ${data.eventTypeName} has moved to ${when}.`,
      ],
    });
  }
  return compose({
    subject: `Updated: ${data.eventTypeName} on ${shortDate(
      data.startUtc,
      timezone,
    )}`,
    lines: [
      `Hi ${data.inviteeName},`,
      `Your ${data.eventTypeName} has moved to ${when}.`,
    ],
    manageUrl: data.manageUrl,
    manageLabel: "Cancel or reschedule",
  });
}

export function reminderEmail(
  data: BookingEmailData,
  timezone: string,
): RenderedEmail {
  const when = formatWhen(data.startUtc, timezone);
  return compose({
    subject: `Reminder: ${data.eventTypeName} on ${shortDate(
      data.startUtc,
      timezone,
    )}`,
    lines: [
      `Hi ${data.inviteeName},`,
      `This is a reminder that your ${data.eventTypeName} is on ${when}.`,
    ],
    manageUrl: data.manageUrl,
    manageLabel: "Cancel or reschedule",
  });
}
