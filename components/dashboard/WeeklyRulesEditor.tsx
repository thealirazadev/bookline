"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { WeeklyRuleRecord } from "@/lib/queries/availability";

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

interface EditWindow {
  start: string;
  end: string;
}

function pad(value: number): string {
  return value.toString().padStart(2, "0");
}

function minutesToTime(minutes: number): string {
  if (minutes >= 1440) return "00:00";
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function groupRules(rules: WeeklyRuleRecord[]): EditWindow[][] {
  const days: EditWindow[][] = WEEKDAYS.map(() => []);
  for (const rule of rules) {
    days[rule.weekday].push({
      start: minutesToTime(rule.startMinute),
      end: minutesToTime(rule.endMinute),
    });
  }
  return days;
}

export function WeeklyRulesEditor({
  initialRules,
}: {
  initialRules: WeeklyRuleRecord[];
}) {
  const [days, setDays] = useState<EditWindow[][]>(() =>
    groupRules(initialRules),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function addWindow(weekday: number) {
    setDays((prev) =>
      prev.map((windows, i) =>
        i === weekday ? [...windows, { start: "09:00", end: "17:00" }] : windows,
      ),
    );
  }

  function removeWindow(weekday: number, index: number) {
    setDays((prev) =>
      prev.map((windows, i) =>
        i === weekday ? windows.filter((_, j) => j !== index) : windows,
      ),
    );
  }

  function updateWindow(
    weekday: number,
    index: number,
    field: "start" | "end",
    value: string,
  ) {
    setDays((prev) =>
      prev.map((windows, i) =>
        i === weekday
          ? windows.map((w, j) => (j === index ? { ...w, [field]: value } : w))
          : windows,
      ),
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const rules = days.flatMap((windows, weekday) =>
        windows.map((w) => {
          const endMinutes = timeToMinutes(w.end);
          return {
            weekday,
            startMinute: timeToMinutes(w.start),
            // Midnight end means end of day, not the start of it.
            endMinute: endMinutes === 0 ? 1440 : endMinutes,
          };
        }),
      );
      const res = await fetch("/api/host/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules }),
      });
      if (res.ok) {
        setSaved(true);
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.error?.fields?.rules ?? data?.error?.message ?? "Save failed.");
    } catch {
      setError("Save failed.");
    } finally {
      setSaving(false);
    }
  }

  const empty = days.every((windows) => windows.length === 0);

  return (
    <div className="flex flex-col gap-4">
      {empty ? (
        <p className="text-sm text-warning">
          You have no availability — visitors can&apos;t book.
        </p>
      ) : null}

      <ul className="flex flex-col gap-3">
        {WEEKDAYS.map((label, weekday) => (
          <li
            key={label}
            className="rounded-md border border-border bg-surface p-4"
          >
            <div className="flex items-center justify-between">
              <span className="font-medium">{label}</span>
              <button
                type="button"
                onClick={() => addWindow(weekday)}
                className="rounded-md px-2 py-1 text-sm font-medium text-accent hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                Add window
              </button>
            </div>
            {days[weekday].length === 0 ? (
              <p className="mt-2 text-sm text-fg-muted">Unavailable</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {days[weekday].map((window, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <input
                      type="time"
                      aria-label={`${label} window ${index + 1} start`}
                      value={window.start}
                      onChange={(e) =>
                        updateWindow(weekday, index, "start", e.target.value)
                      }
                      className="min-h-[44px] rounded-sm border border-border bg-bg px-2 py-1 text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
                    />
                    <span aria-hidden="true">&ndash;</span>
                    <input
                      type="time"
                      aria-label={`${label} window ${index + 1} end`}
                      value={window.end}
                      onChange={(e) =>
                        updateWindow(weekday, index, "end", e.target.value)
                      }
                      className="min-h-[44px] rounded-sm border border-border bg-bg px-2 py-1 text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
                    />
                    <button
                      type="button"
                      onClick={() => removeWindow(weekday, index)}
                      aria-label={`Remove ${label} window ${index + 1}`}
                      className="rounded-md px-2 py-1 text-sm text-danger hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>

      <p className="text-sm text-fg-muted">
        An end time earlier than the start means the window crosses midnight.
      </p>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-sm text-success">
          Saved.
        </p>
      ) : null}

      <div>
        <Button onClick={handleSave} loading={saving}>
          {saving ? "Saving..." : "Save weekly hours"}
        </Button>
      </div>
    </div>
  );
}
