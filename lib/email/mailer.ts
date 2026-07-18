import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";
import { logger, redactEmail } from "@/lib/logger";

export interface MailAttachment {
  filename: string;
  content: string;
  contentType: string;
}

export interface OutgoingMail {
  to: string;
  subject: string;
  text: string;
  html: string;
  attachments?: MailAttachment[];
}

let transport: Transporter | null = null;

function getTransport(): Transporter {
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
        : undefined,
    });
  }
  return transport;
}

/**
 * Send one message. Never throws: a failed send is logged and reported as
 * false so a stored booking is not rolled back by an email outage.
 */
export async function sendMail(mail: OutgoingMail): Promise<boolean> {
  try {
    await getTransport().sendMail({
      from: env.MAIL_FROM,
      to: mail.to,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      attachments: mail.attachments,
    });
    logger.info({ event: "email.sent", to: redactEmail(mail.to) });
    return true;
  } catch (error) {
    logger.warn({
      event: "email.failed",
      to: redactEmail(mail.to),
      message: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
