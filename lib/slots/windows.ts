import type {
  BlackoutInput,
  DateOverrideInput,
  ResolvedWindow,
  WeeklyRule,
} from "./types";

/**
 * Resolve the availability windows for a single host-local date. Precedence:
 * a blackout closes the date entirely; otherwise any override rows for the date
 * replace the weekly rules; otherwise the weekly rules for the date's weekday.
 */
export function resolveWindows(
  hostDate: string,
  weekday: number,
  rules: WeeklyRule[],
  overrides: DateOverrideInput[],
  blackouts: BlackoutInput[],
): ResolvedWindow[] {
  if (blackouts.some((b) => b.date === hostDate)) {
    return [];
  }

  const dayOverrides = overrides.filter((o) => o.date === hostDate);
  if (dayOverrides.length > 0) {
    return dayOverrides.map((o) => ({
      startMinute: o.startMinute,
      endMinute: o.endMinute,
    }));
  }

  return rules
    .filter((r) => r.weekday === weekday)
    .map((r) => ({ startMinute: r.startMinute, endMinute: r.endMinute }));
}
