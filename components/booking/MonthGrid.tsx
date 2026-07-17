"use client";

import { DateTime } from "luxon";
import { Skeleton } from "@/components/ui/Skeleton";
import type { DayAvailability } from "@/lib/slots/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

interface MonthGridProps {
  month: string; // YYYY-MM
  days: DayAvailability[];
  selectedDate: string | null;
  todayIso: string;
  loading: boolean;
  onSelect: (date: string) => void;
  onChangeMonth: (month: string) => void;
}

function shiftMonth(month: string, delta: number): string {
  return DateTime.fromISO(`${month}-01`)
    .plus({ months: delta })
    .toFormat("yyyy-LL");
}

export function MonthGrid({
  month,
  days,
  selectedDate,
  todayIso,
  loading,
  onSelect,
  onChangeMonth,
}: MonthGridProps) {
  const first = DateTime.fromISO(`${month}-01`);
  const leading = first.weekday - 1; // Monday-based offset
  const monthLabel = first.toFormat("LLLL yyyy");
  const availabilityByDate = new Map(days.map((d) => [d.date, d.hasSlots]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChangeMonth(shiftMonth(month, -1))}
          className="rounded-md px-2 py-1 text-fg hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          aria-label="Previous month"
        >
          &larr;
        </button>
        <h2 className="text-[1.25rem] font-semibold" aria-live="polite">
          {monthLabel}
        </h2>
        <button
          type="button"
          onClick={() => onChangeMonth(shiftMonth(month, 1))}
          className="rounded-md px-2 py-1 text-fg hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
          aria-label="Next month"
        >
          &rarr;
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-sm text-fg-muted">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-11" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leading }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {days.map((day) => {
            const dayNum = DateTime.fromISO(day.date).day;
            const hasSlots = availabilityByDate.get(day.date) ?? false;
            const isSelected = day.date === selectedDate;
            const isToday = day.date === todayIso;
            if (!hasSlots) {
              return (
                <div
                  key={day.date}
                  aria-disabled="true"
                  className="flex h-11 items-center justify-center rounded-sm text-fg-muted opacity-50"
                >
                  <span className="tabular-nums">{dayNum}</span>
                </div>
              );
            }
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => onSelect(day.date)}
                aria-pressed={isSelected}
                aria-label={`${first.set({ day: dayNum }).toFormat("MMMM d")}, times available`}
                className={`flex h-11 flex-col items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                  isSelected
                    ? "bg-accent text-accent-fg"
                    : "text-fg hover:bg-surface-2"
                } ${isToday && !isSelected ? "outline outline-1 outline-accent" : ""}`}
              >
                <span className="tabular-nums">{dayNum}</span>
                {!isSelected ? (
                  <span
                    className="mt-0.5 h-1 w-1 rounded-full bg-accent"
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
