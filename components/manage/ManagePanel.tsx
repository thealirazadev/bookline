"use client";

import { DateTime } from "luxon";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

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

  async function handleCancel() {
    setCancelling(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/manage/${token}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reason.trim() ? { reason: reason.trim() } : {}),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error?.message ?? "Cancellation failed.");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Cancellation failed.",
      );
    } finally {
      setCancelling(false);
    }
  }

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

      {actionable ? (
        <div className="flex flex-wrap gap-3">
          {actions.reschedulable ? (
            <Link
              href={`/manage/${token}/reschedule`}
              className="inline-flex min-h-[44px] items-center justify-center rounded-md border border-border bg-surface px-4 py-2 font-medium text-fg hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
            >
              Reschedule
            </Link>
          ) : null}
          {actions.cancellable ? (
            <Button variant="danger" onClick={() => setDialogOpen(true)}>
              Cancel booking
            </Button>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-fg-muted">
          {booking.status === "cancelled"
            ? "This booking has been cancelled."
            : "This booking can no longer be changed."}
        </p>
      )}

      {actionError ? (
        <p role="alert" className="text-sm text-danger">
          {actionError}
        </p>
      ) : null}

      {dialogOpen ? (
        <ConfirmDialog
          title="Cancel this booking?"
          message="The host and you will be emailed a cancellation. This cannot be undone."
          confirmLabel={cancelling ? "Cancelling..." : "Cancel booking"}
          loading={cancelling}
          onConfirm={handleCancel}
          onClose={() => setDialogOpen(false)}
        >
          <label
            htmlFor="cancel-reason"
            className="mb-1 block text-sm font-medium text-fg"
          >
            Reason (optional)
          </label>
          <textarea
            id="cancel-reason"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
            className="min-h-[80px] w-full rounded-sm border border-border bg-bg px-3 py-2 text-fg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
          />
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
