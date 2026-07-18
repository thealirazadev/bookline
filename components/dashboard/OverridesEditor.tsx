"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type {
  BlackoutRecord,
  OverrideRecord,
} from "@/lib/queries/availability";

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

interface EditWindow {
  start: string;
  end: string;
}

export function OverridesEditor({
  initialOverrides,
  initialBlackouts,
}: {
  initialOverrides: OverrideRecord[];
  initialBlackouts: BlackoutRecord[];
}) {
  const [overrides, setOverrides] = useState(initialOverrides);
  const [blackouts, setBlackouts] = useState(initialBlackouts);

  const [overrideDate, setOverrideDate] = useState("");
  const [windows, setWindows] = useState<EditWindow[]>([
    { start: "09:00", end: "17:00" },
  ]);
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [savingOverride, setSavingOverride] = useState(false);

  const [blackoutDate, setBlackoutDate] = useState("");
  const [blackoutError, setBlackoutError] = useState<string | null>(null);
  const [savingBlackout, setSavingBlackout] = useState(false);

  async function saveOverride() {
    if (!overrideDate) {
      setOverrideError("Pick a date.");
      return;
    }
    setSavingOverride(true);
    setOverrideError(null);
    try {
      const payload = {
        date: overrideDate,
        windows: windows.map((w) => {
          const end = timeToMinutes(w.end);
          return {
            startMinute: timeToMinutes(w.start),
            endMinute: end === 0 ? 1440 : end,
          };
        }),
      };
      const res = await fetch("/api/host/overrides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setOverrides(data.overrides as OverrideRecord[]);
        setOverrideDate("");
        setWindows([{ start: "09:00", end: "17:00" }]);
        return;
      }
      setOverrideError(
        data?.error?.fields?.windows ??
          data?.error?.fields?.date ??
          data?.error?.message ??
          "Save failed.",
      );
    } catch {
      setOverrideError("Save failed.");
    } finally {
      setSavingOverride(false);
    }
  }

  async function deleteOverride(id: string) {
    const res = await fetch(`/api/host/overrides/${id}`, { method: "DELETE" });
    if (res.ok) setOverrides((prev) => prev.filter((o) => o.id !== id));
  }

  async function addBlackout() {
    if (!blackoutDate) {
      setBlackoutError("Pick a date.");
      return;
    }
    setSavingBlackout(true);
    setBlackoutError(null);
    try {
      const res = await fetch("/api/host/blackouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: blackoutDate }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setBlackouts(data.blackouts as BlackoutRecord[]);
        setBlackoutDate("");
        return;
      }
      setBlackoutError(
        data?.error?.fields?.date ?? data?.error?.message ?? "Save failed.",
      );
    } catch {
      setBlackoutError("Save failed.");
    } finally {
      setSavingBlackout(false);
    }
  }

  async function deleteBlackout(id: string) {
    const res = await fetch(`/api/host/blackouts/${id}`, { method: "DELETE" });
    if (res.ok) setBlackouts((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="text-[1.25rem] font-semibold">Date overrides</h2>
        <p className="text-sm text-fg-muted">
          An override replaces the weekly hours for a single date.
        </p>

        {overrides.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {overrides.map((override) => (
              <li
                key={override.id}
                className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-2"
              >
                <span className="tabular-nums">
                  {override.date}: {minutesToTime(override.startMinute)}&ndash;
                  {minutesToTime(override.endMinute)}
                </span>
                <button
                  type="button"
                  onClick={() => deleteOverride(override.id)}
                  className="text-sm text-danger hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-col gap-3 rounded-md border border-border bg-surface p-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Date
            <input
              type="date"
              value={overrideDate}
              onChange={(e) => setOverrideDate(e.target.value)}
              className="min-h-[44px] w-fit rounded-sm border border-border bg-bg px-3 py-2 text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
            />
          </label>
          {windows.map((window, index) => (
            <div key={index} className="flex items-center gap-2">
              <input
                type="time"
                aria-label={`Window ${index + 1} start`}
                value={window.start}
                onChange={(e) =>
                  setWindows((prev) =>
                    prev.map((w, j) =>
                      j === index ? { ...w, start: e.target.value } : w,
                    ),
                  )
                }
                className="min-h-[44px] rounded-sm border border-border bg-bg px-2 py-1 text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
              />
              <span aria-hidden="true">&ndash;</span>
              <input
                type="time"
                aria-label={`Window ${index + 1} end`}
                value={window.end}
                onChange={(e) =>
                  setWindows((prev) =>
                    prev.map((w, j) =>
                      j === index ? { ...w, end: e.target.value } : w,
                    ),
                  )
                }
                className="min-h-[44px] rounded-sm border border-border bg-bg px-2 py-1 text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
              />
              {windows.length > 1 ? (
                <button
                  type="button"
                  onClick={() =>
                    setWindows((prev) => prev.filter((_, j) => j !== index))
                  }
                  className="text-sm text-danger hover:underline"
                >
                  Remove
                </button>
              ) : null}
            </div>
          ))}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setWindows((prev) => [...prev, { start: "09:00", end: "17:00" }])
              }
              className="text-sm font-medium text-accent hover:underline"
            >
              Add window
            </button>
          </div>
          {overrideError ? (
            <p role="alert" className="text-sm text-danger">
              {overrideError}
            </p>
          ) : null}
          <div>
            <Button onClick={saveOverride} loading={savingOverride}>
              Save override
            </Button>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-[1.25rem] font-semibold">Blackout dates</h2>
        <p className="text-sm text-fg-muted">
          A blackout closes a date entirely, beating rules and overrides.
        </p>

        {blackouts.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {blackouts.map((blackout) => (
              <li
                key={blackout.id}
                className="flex items-center justify-between rounded-md border border-border bg-surface px-4 py-2"
              >
                <span className="tabular-nums">{blackout.date}</span>
                <button
                  type="button"
                  onClick={() => deleteBlackout(blackout.id)}
                  className="text-sm text-danger hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap items-end gap-2 rounded-md border border-border bg-surface p-4">
          <label className="flex flex-col gap-1 text-sm font-medium">
            Date
            <input
              type="date"
              value={blackoutDate}
              onChange={(e) => setBlackoutDate(e.target.value)}
              className="min-h-[44px] rounded-sm border border-border bg-bg px-3 py-2 text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring"
            />
          </label>
          <Button
            variant="secondary"
            onClick={addBlackout}
            loading={savingBlackout}
          >
            Add blackout
          </Button>
          {blackoutError ? (
            <p role="alert" className="w-full text-sm text-danger">
              {blackoutError}
            </p>
          ) : null}
        </div>
      </section>
    </div>
  );
}
