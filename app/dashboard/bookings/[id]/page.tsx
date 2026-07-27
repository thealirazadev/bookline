import { DateTime } from "luxon";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { loadDashboardBookingDetail } from "@/lib/queries/bookings";
import { getSessionHost } from "@/lib/queries/host";

export const dynamic = "force-dynamic";

function formatWhen(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: "utc" })
    .setZone(timezone)
    .toFormat("cccc, LLLL d, yyyy 'at' h:mm a");
}

export default async function BookingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const host = await getSessionHost();
  if (!host) redirect("/login");

  const { id } = await params;
  const booking = await loadDashboardBookingDetail(id, host.id);
  if (!booking) notFound();

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href="/dashboard"
          className="text-sm text-accent underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Back to bookings
        </Link>
        <h1 className="text-[1.75rem] font-bold leading-tight">
          {booking.eventTypeName}
        </h1>
      </div>

      <dl className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
        <div className="flex justify-between gap-4">
          <dt className="text-sm text-fg-muted">Status</dt>
          <dd>
            <Badge
              tone={booking.status === "cancelled" ? "cancelled" : "confirmed"}
            >
              {booking.status}
            </Badge>
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-sm text-fg-muted">When</dt>
          <dd className="text-right tabular-nums">
            {formatWhen(booking.startUtc, host.timezone)}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-sm text-fg-muted">Invitee</dt>
          <dd className="text-right">
            <div className="break-words">{booking.inviteeName}</div>
            <div className="break-words text-fg-muted">
              {booking.inviteeEmail}
            </div>
          </dd>
        </div>
        <p className="text-xs text-fg-muted">Time shown in {host.timezone}</p>
      </dl>

      <div className="flex flex-col gap-3">
        <h2 className="text-[1.25rem] font-semibold">Intake answers</h2>
        {booking.answers.length === 0 ? (
          <p className="text-sm text-fg-muted">
            No intake questions were answered for this booking.
          </p>
        ) : (
          <dl className="flex flex-col gap-3">
            {booking.answers.map((answer) => (
              <div
                key={answer.id}
                className="rounded-md border border-border bg-surface p-3"
              >
                <dt className="text-sm font-medium text-fg-muted">
                  {answer.label}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap break-words text-fg">
                  {answer.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </section>
  );
}
