import { pathToFileURL } from "node:url";
import { prisma } from "@/lib/db";
import { sendReminderEmail } from "@/lib/email/notifications";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { loadBookingContext } from "@/lib/queries/bookings";
import { manageUrl } from "@/lib/tokens";

async function sendReminderFor(bookingId: string): Promise<boolean> {
  const booking = await loadBookingContext(bookingId);
  if (!booking) return false;

  const url = manageUrl(env.APP_BASE_URL, booking.id, env.LINK_TOKEN_SECRET);
  return sendReminderEmail({
    icsUid: booking.icsUid,
    icsSequence: booking.icsSequence,
    eventTypeName: booking.eventType.name,
    startUtc: booking.startUtc,
    endUtc: booking.endUtc,
    invitee: {
      name: booking.inviteeName,
      email: booking.inviteeEmail,
      timezone: booking.inviteeTimezone,
    },
    host: {
      name: booking.host.name,
      email: booking.host.email,
      timezone: booking.host.timezone,
    },
    manageUrl: url,
  });
}

/**
 * Claim and send due reminders. The claim is a single atomic UPDATE that sets
 * reminderSentAt while it is still NULL, so a concurrent run (or a double fire)
 * can never claim the same booking twice. A failed send releases the claim so
 * the next tick retries.
 */
export async function runReminders(now: Date = new Date()): Promise<number> {
  const claimed = await prisma.$queryRaw<Array<{ id: string }>>`
    UPDATE "Booking" AS b
    SET "reminderSentAt" = ${now}
    FROM "EventType" AS e
    WHERE b."eventTypeId" = e.id
      AND b."reminderSentAt" IS NULL
      AND b.status = 'confirmed'
      AND e."reminderLeadMin" > 0
      AND b."startUtc" > ${now}
      AND b."startUtc" <= ${now} + make_interval(mins => e."reminderLeadMin")
    RETURNING b.id
  `;

  let sent = 0;
  for (const { id } of claimed) {
    const ok = await sendReminderFor(id);
    if (ok) {
      sent += 1;
      logger.info({ event: "reminder.sent", bookingId: id });
    } else {
      await prisma.booking.update({
        where: { id },
        data: { reminderSentAt: null },
      });
      logger.warn({ event: "reminder.retry", bookingId: id });
    }
  }
  return sent;
}

let running = false;
let timer: NodeJS.Timeout | null = null;

/** Start the in-process 60s reminder loop (Node runtime only). */
export function startReminderLoop(): void {
  if (timer) return;
  timer = setInterval(() => {
    if (running) return; // skip if the previous tick is still working
    running = true;
    runReminders()
      .catch((error: unknown) => {
        logger.error({
          event: "reminder.loop_error",
          message: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        running = false;
      });
  }, 60_000);
}

// Allow `tsx jobs/reminders.ts` (npm run reminders:once) to run one pass.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runReminders()
    .then((count) => {
      logger.info({ event: "reminder.once", code: `SENT_${count}` });
    })
    .catch((error: unknown) => {
      logger.error({
        event: "reminder.once_error",
        message: error instanceof Error ? error.message : String(error),
      });
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
