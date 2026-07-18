import { z } from "zod";
import { dateSchema } from "./common";

export const WEEKDAY_NAMES = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

const windowShape = {
  startMinute: z.number().int().min(0).max(1439),
  endMinute: z.number().int().min(1).max(1440),
};

const ruleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  ...windowShape,
});

export const weeklyRulesSchema = z.object({
  rules: z.array(ruleSchema),
});

export const overridesSchema = z.object({
  date: dateSchema,
  windows: z.array(z.object(windowShape)),
});

export const blackoutSchema = z.object({
  date: dateSchema,
});

export type WeeklyRuleInput = z.infer<typeof ruleSchema>;

interface Window {
  startMinute: number;
  endMinute: number;
}

// A window that ends at or before it starts crosses midnight; extend its end so
// overlap is a simple linear interval intersection on the same day's timeline.
function effectiveEnd(window: Window): number {
  return window.endMinute > window.startMinute
    ? window.endMinute
    : window.endMinute + 1440;
}

function windowsOverlap(a: Window, b: Window): boolean {
  return a.startMinute < effectiveEnd(b) && b.startMinute < effectiveEnd(a);
}

/** First weekday (0-6) with overlapping windows, or null if none overlap. */
export function findWeeklyOverlap(rules: WeeklyRuleInput[]): number | null {
  const byWeekday = new Map<number, Window[]>();
  for (const rule of rules) {
    const list = byWeekday.get(rule.weekday) ?? [];
    list.push(rule);
    byWeekday.set(rule.weekday, list);
  }
  for (const [weekday, windows] of byWeekday) {
    for (let i = 0; i < windows.length; i += 1) {
      for (let j = i + 1; j < windows.length; j += 1) {
        if (windowsOverlap(windows[i], windows[j])) return weekday;
      }
    }
  }
  return null;
}

/** First index of an overlapping pair within a single day's windows, or null. */
export function findWindowOverlap(windows: Window[]): boolean {
  for (let i = 0; i < windows.length; i += 1) {
    for (let j = i + 1; j < windows.length; j += 1) {
      if (windowsOverlap(windows[i], windows[j])) return true;
    }
  }
  return false;
}
