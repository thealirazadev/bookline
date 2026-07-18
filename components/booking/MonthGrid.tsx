"use client";

import { DateTime } from "luxon";
import { useEffect, useRef, useState } from "react";
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
  const cellRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const preferredFocus =
    (selectedDate && days.some((d) => d.date === selectedDate)
      ? selectedDate
      : null) ??
    (days.some((d) => d.date === todayIso) ? todayIso : null) ??
    days[0]?.date ??
    null;
  const [focusedDate, setFocusedDate] = useState<string | null>(preferredFocus);

  // Keep the roving focus target valid when the month (and its days) change.
  useEffect(() => {
    if (!focusedDate || !days.some((d) => d.date === focusedDate)) {
      setFocusedDate(preferredFocus);
    }
  }, [days, focusedDate, preferredFocus]);

  function focusDate(date: string) {
    setFocusedDate(date);
    cellRefs.current.get(date)?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    if (!focusedDate) return;
    const index = days.findIndex((d) => d.date === focusedDate);
    if (index < 0) return;
    const column = (leading + index) % 7;

    const goto = (target: number) => {
      const clamped = Math.max(0, Math.min(days.length - 1, target));
      event.preventDefault();
      focusDate(days[clamped].date);
    };

    switch (event.key) {
      case "ArrowRight":
        goto(index + 1);
        break;
      case "ArrowLeft":
        goto(index - 1);
        break;
      case "ArrowDown":
        goto(index + 7);
        break;
      case "ArrowUp":
        goto(index - 7);
        break;
      case "Home":
        goto(index - column);
        break;
      case "End":
        goto(index + (6 - column));
        break;
      case "PageUp":
        event.preventDefault();
        onChangeMonth(shiftMonth(month, -1));
        break;
      case "PageDown":
        event.preventDefault();
        onChangeMonth(shiftMonth(month, 1));
        break;
      case "Enter":
      case " ": {
        const day = days[index];
        if (day?.hasSlots) {
          event.preventDefault();
          onSelect(day.date);
        }
        break;
      }
      default:
        break;
    }
  }

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

      <div
        className="grid grid-cols-7 gap-1 text-center text-sm text-fg-muted"
        aria-hidden="true"
      >
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
        <div
          role="grid"
          aria-label={`${monthLabel}, choose a day`}
          onKeyDown={handleKeyDown}
          className="grid grid-cols-7 gap-1"
        >
          {Array.from({ length: leading }).map((_, i) => (
            <div key={`pad-${i}`} role="presentation" />
          ))}
          {days.map((day) => {
            const dayNum = DateTime.fromISO(day.date).day;
            const isSelected = day.date === selectedDate;
            const isToday = day.date === todayIso;
            const isFocusTarget = day.date === focusedDate;
            const label = `${first.set({ day: dayNum }).toFormat("MMMM d")}, ${
              day.hasSlots ? "times available" : "no times available"
            }${isSelected ? ", selected" : ""}${isToday ? ", today" : ""}`;
            return (
              <button
                key={day.date}
                ref={(node) => {
                  if (node) cellRefs.current.set(day.date, node);
                  else cellRefs.current.delete(day.date);
                }}
                type="button"
                role="gridcell"
                tabIndex={isFocusTarget ? 0 : -1}
                aria-selected={isSelected}
                aria-disabled={!day.hasSlots}
                aria-label={label}
                onClick={() => {
                  setFocusedDate(day.date);
                  if (day.hasSlots) onSelect(day.date);
                }}
                className={`flex h-11 flex-col items-center justify-center rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring ${
                  day.hasSlots
                    ? isSelected
                      ? "bg-accent text-accent-fg"
                      : "text-fg hover:bg-surface-2"
                    : "text-fg-muted opacity-50"
                } ${isToday && !isSelected ? "outline outline-1 outline-accent" : ""}`}
              >
                <span className="tabular-nums">{dayNum}</span>
                {day.hasSlots && !isSelected ? (
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
