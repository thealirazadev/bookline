"use client";

import { DateTime } from "luxon";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Slot } from "@/lib/slots/types";

interface SlotListProps {
  slots: Slot[];
  selectedStart: string | null;
  timezone: string;
  loading: boolean;
  hasSelectedDate: boolean;
  onSelect: (slot: Slot) => void;
}

function formatTime(iso: string, timezone: string): string {
  return DateTime.fromISO(iso, { zone: "utc" })
    .setZone(timezone)
    .toFormat("h:mm a");
}

export function SlotList({
  slots,
  selectedStart,
  timezone,
  loading,
  hasSelectedDate,
  onSelect,
}: SlotListProps) {
  // A single persistent live region so a screen reader hears the outcome of
  // choosing a day, including the empty case, which was previously silent.
  const announcement =
    !hasSelectedDate || loading
      ? ""
      : slots.length === 0
        ? "No open times on this day."
        : `${slots.length} ${slots.length === 1 ? "time" : "times"} available, shown in ${timezone}.`;

  return (
    <div className="flex flex-col gap-2">
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {!hasSelectedDate ? (
        <p className="text-sm text-fg-muted">Select a day to see open times.</p>
      ) : loading ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : slots.length === 0 ? (
        <EmptyState
          heading="No open times on this day"
          message="Try another date."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {slots.map((slot) => {
              const isSelected = slot.startUtc === selectedStart;
              return (
                <li key={slot.startUtc}>
                  <button
                    type="button"
                    onClick={() => onSelect(slot)}
                    aria-pressed={isSelected}
                    className={`min-h-[44px] w-full rounded-md border px-4 py-2 text-left tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                      isSelected
                        ? "border-accent bg-accent text-accent-fg"
                        : "border-border bg-surface text-fg hover:border-accent hover:bg-surface-2"
                    }`}
                  >
                    {formatTime(slot.startUtc, timezone)}
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-sm text-fg-muted">Times shown in {timezone}</p>
        </>
      )}
    </div>
  );
}
