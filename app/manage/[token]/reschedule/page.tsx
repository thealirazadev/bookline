import Link from "next/link";
import { ReschedulePanel } from "@/components/manage/ReschedulePanel";
import { env } from "@/lib/env";
import { getManageBookingView } from "@/lib/queries/bookings";
import { verifyManageToken } from "@/lib/tokens";

export default async function RescheduleBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const bookingId = verifyManageToken(token, env.LINK_TOKEN_SECRET);
  const view = bookingId ? await getManageBookingView(bookingId) : null;

  if (!view || !view.actions.reschedulable) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
        <div className="rounded-md border border-border bg-surface p-6 shadow-card">
          <h1 className="text-[1.25rem] font-semibold">
            This booking can&apos;t be rescheduled
          </h1>
          <p className="mt-2 text-fg-muted">
            It may have been cancelled or already passed.
          </p>
          <Link
            href={`/manage/${token}`}
            className="mt-4 inline-block text-accent underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          >
            Back to booking
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[960px] px-4 py-10 md:px-6">
      <ReschedulePanel
        token={token}
        eventTypeSlug={view.booking.eventType.slug}
        eventName={view.booking.eventType.name}
        initialTimezone={view.booking.inviteeTimezone}
      />
    </main>
  );
}
