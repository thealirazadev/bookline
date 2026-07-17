"use client";

import { DateTime } from "luxon";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

interface ManageView {
  booking: {
    id: string;
    eventType: { slug: string; name: string; durationMin: number };
    startUtc: string;
    endUtc: string;
    inviteeName: string;
    inviteeTimezone: string;
    status: string;
  };
  actions: { cancellable: boolean; reschedulable: boolean };
}

export function ManagePanel({ token }: { token: string }) {
  const [view, setView] = useState<ManageView | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/manage/${token}`);
      if (res.status === 404) {
        setInvalid(true);
        return;
      }
      if (!res.ok) throw new Error("load");
      setView((await res.json()) as ManageView);
    } catch {
      setInvalid(true);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-24" />
      </div>
    );
  }

  if (invalid || !view) {
    return (
      <div className="rounded-md border border-border bg-surface p-6 shadow-card">
        <h1 className="text-[1.25rem] font-semibold">This link isn&apos;t valid</h1>
        <p className="mt-2 text-fg-muted">
          The link may be incomplete. Please check the most recent email.
        </p>
      </div>
    );
  }

  const { booking, actions } = view;
  const timezone = booking.inviteeTimezone;
  const when = DateTime.fromISO(booking.startUtc, { zone: "utc" })
    .setZone(timezone)
    .toFormat("cccc, LLLL d, yyyy 'at' h:mm a");
  const actionable = actions.cancellable || actions.reschedulable;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <h1 className="text-[1.75rem] font-bold leading-tight">
          {booking.eventType.name}
        </h1>
        <Badge tone={booking.status === "cancelled" ? "cancelled" : "confirmed"}>
          {booking.status}
        </Badge>
      </div>

      <div className="rounded-md border border-border bg-surface p-4 shadow-card">
        <p className="text-fg tabular-nums">{when}</p>
        <p className="mt-1 text-sm text-fg-muted">Times shown in {timezone}</p>
        <p className="mt-1 text-sm text-fg-muted">
          Booked by {booking.inviteeName}
        </p>
      </div>

      {!actionable ? (
        <p className="text-sm text-fg-muted">
          {booking.status === "cancelled"
            ? "This booking has been cancelled."
            : "This booking can no longer be changed."}
        </p>
      ) : null}
    </div>
  );
}
