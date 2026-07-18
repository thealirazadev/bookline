"use client";

import { DateTime } from "luxon";

export interface BookingConfirmationData {
  booking: {
    startUtc: string;
    endUtc: string;
    inviteeName: string;
    eventType: { name: string };
  };
  manageUrl: string;
  emailStatus: "sent" | "pending";
}

export function BookingConfirmation({
  data,
  timezone,
}: {
  data: BookingConfirmationData;
  timezone: string;
}) {
  const when = DateTime.fromISO(data.booking.startUtc, { zone: "utc" })
    .setZone(timezone)
    .toFormat("cccc, LLLL d, yyyy 'at' h:mm a");

  return (
    <div className="rounded-md border border-border bg-surface p-6 shadow-card">
      <h2 className="text-[1.25rem] font-semibold">You&apos;re booked</h2>
      <p className="mt-2 text-fg">
        {data.booking.eventType.name} on <span className="tabular-nums">{when}</span>
      </p>
      <p className="mt-1 text-sm text-fg-muted">Times shown in {timezone}</p>

      {data.emailStatus === "sent" ? (
        <p className="mt-4 text-sm text-fg-muted">
          A confirmation email with a calendar invite is on its way.
        </p>
      ) : (
        <p className="mt-4 text-sm text-warning">
          Your booking is confirmed, but we couldn&apos;t send the confirmation
          email. Keep this link to manage your booking.
        </p>
      )}

      <p className="mt-4 text-sm">
        Need to make a change?{" "}
        <a
          href={data.manageUrl}
          className="text-accent underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Cancel or reschedule
        </a>
      </p>
    </div>
  );
}
