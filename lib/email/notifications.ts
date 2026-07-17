import { buildInviteIcs, type InviteBooking } from "@/lib/ics/invite";
import type { CalendarMethod } from "@/lib/ics/writer";
import { sendMail, type MailAttachment } from "./mailer";
import {
  cancellationEmail,
  confirmationEmail,
  rescheduleEmail,
  type BookingEmailData,
  type RenderedEmail,
} from "./templates";

export type EmailStatus = "sent" | "pending";

export interface BookingNotification {
  icsUid: string;
  icsSequence: number;
  eventTypeName: string;
  startUtc: Date;
  endUtc: Date;
  invitee: { name: string; email: string; timezone: string };
  host: { name: string; email: string; timezone: string };
  manageUrl: string;
}

function emailData(notification: BookingNotification): BookingEmailData {
  return {
    eventTypeName: notification.eventTypeName,
    inviteeName: notification.invitee.name,
    inviteeEmail: notification.invitee.email,
    hostName: notification.host.name,
    startUtc: notification.startUtc,
    endUtc: notification.endUtc,
    manageUrl: notification.manageUrl,
  };
}

function icsAttachment(
  notification: BookingNotification,
  method: CalendarMethod,
): MailAttachment {
  const invite: InviteBooking = {
    icsUid: notification.icsUid,
    icsSequence: notification.icsSequence,
    startUtc: notification.startUtc,
    endUtc: notification.endUtc,
    eventTypeName: notification.eventTypeName,
    inviteeName: notification.invitee.name,
    inviteeEmail: notification.invitee.email,
    hostName: notification.host.name,
    hostEmail: notification.host.email,
    manageUrl: notification.manageUrl,
  };
  return {
    filename: "invite.ics",
    content: buildInviteIcs(invite, method),
    contentType: `text/calendar; charset=utf-8; method=${method}`,
  };
}

async function sendBoth(
  notification: BookingNotification,
  method: CalendarMethod,
  invitee: RenderedEmail,
  host: RenderedEmail,
): Promise<EmailStatus> {
  const attachment = icsAttachment(notification, method);
  const results = await Promise.all([
    sendMail({
      to: notification.invitee.email,
      ...invitee,
      attachments: [attachment],
    }),
    sendMail({
      to: notification.host.email,
      ...host,
      attachments: [attachment],
    }),
  ]);
  return results.every(Boolean) ? "sent" : "pending";
}

export async function sendConfirmationEmails(
  notification: BookingNotification,
): Promise<EmailStatus> {
  const data = emailData(notification);
  return sendBoth(
    notification,
    "REQUEST",
    confirmationEmail(data, notification.invitee.timezone, "invitee"),
    confirmationEmail(data, notification.host.timezone, "host"),
  );
}

export async function sendCancellationEmails(
  notification: BookingNotification,
  reason?: string,
): Promise<EmailStatus> {
  const data = emailData(notification);
  return sendBoth(
    notification,
    "CANCEL",
    cancellationEmail(data, notification.invitee.timezone, "invitee", reason),
    cancellationEmail(data, notification.host.timezone, "host", reason),
  );
}

export async function sendRescheduleEmails(
  notification: BookingNotification,
): Promise<EmailStatus> {
  const data = emailData(notification);
  return sendBoth(
    notification,
    "REQUEST",
    rescheduleEmail(data, notification.invitee.timezone, "invitee"),
    rescheduleEmail(data, notification.host.timezone, "host"),
  );
}
