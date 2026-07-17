"use client";

import { DateTime } from "luxon";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { DashboardBooking } from "@/lib/queries/bookings";

interface BookingsTableProps {
  upcoming: DashboardBooking[];
  past: DashboardBooking[];
  hostTimezone: string;
}

type Tab = "upcoming" | "past";

function formatWhen(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: "utc" })
    .setZone(timezone)
    .toFormat("ccc, LLL d, yyyy 'at' h:mm a");
}

export function BookingsTable({
  upcoming,
  past,
  hostTimezone,
}: BookingsTableProps) {
  const [tab, setTab] = useState<Tab>("upcoming");
  const rows = tab === "upcoming" ? upcoming : past;

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Bookings" className="flex gap-2 border-b border-border">
        {(["upcoming", "past"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium capitalize focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
              tab === value
                ? "border-accent text-fg"
                : "border-transparent text-fg-muted hover:text-fg"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          heading={tab === "upcoming" ? "No upcoming bookings" : "No past bookings"}
          message={
            tab === "upcoming"
              ? "New bookings will appear here."
              : "Past bookings will appear here."
          }
        />
      ) : (
        <>
          <table className="hidden w-full border-collapse text-sm md:table">
            <thead>
              <tr className="border-b border-border text-left text-fg-muted">
                <th className="py-2 pr-4 font-medium">When</th>
                <th className="py-2 pr-4 font-medium">Event</th>
                <th className="py-2 pr-4 font-medium">Invitee</th>
                <th className="py-2 pr-4 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((booking) => (
                <tr
                  key={booking.id}
                  className="border-b border-border hover:bg-surface-2"
                >
                  <td className="py-3 pr-4 tabular-nums">
                    {formatWhen(booking.startUtc, hostTimezone)}
                  </td>
                  <td className="py-3 pr-4">{booking.eventTypeName}</td>
                  <td className="py-3 pr-4">
                    <div>{booking.inviteeName}</div>
                    <div className="text-fg-muted">{booking.inviteeEmail}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <Badge
                      tone={
                        booking.status === "cancelled" ? "cancelled" : "confirmed"
                      }
                    >
                      {booking.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <ul className="flex flex-col gap-3 md:hidden">
            {rows.map((booking) => (
              <li
                key={booking.id}
                className="rounded-md border border-border bg-surface p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{booking.eventTypeName}</span>
                  <Badge
                    tone={
                      booking.status === "cancelled" ? "cancelled" : "confirmed"
                    }
                  >
                    {booking.status}
                  </Badge>
                </div>
                <p className="mt-1 text-sm tabular-nums text-fg-muted">
                  {formatWhen(booking.startUtc, hostTimezone)}
                </p>
                <p className="mt-1 text-sm">{booking.inviteeName}</p>
              </li>
            ))}
          </ul>
          <p className="text-xs text-fg-muted">Times shown in {hostTimezone}</p>
        </>
      )}
    </div>
  );
}
