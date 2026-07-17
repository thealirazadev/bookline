import { DateTime } from "luxon";
import { resolveWindows } from "./windows";
import type {
  BlockRange,
  DayAvailability,
  ResolvedWindow,
  Slot,
  SlotQuery,
} from "./types";

const MINUTES_PER_DAY = 1440;

/** Luxon weekday (1 = Mon .. 7 = Sun) to the schema's 0 = Mon .. 6 = Sun. */
function toWeekdayIndex(dt: DateTime): number {
  return dt.weekday - 1;
}

function utcIso(dt: DateTime): string {
  return dt.toUTC().toFormat("yyyy-MM-dd'T'HH:mm:ss'Z'");
}

/**
 * Project a host-local wall time (absolute minutes from the date's midnight,
 * may exceed 1440 for midnight-crossing windows) to a UTC instant. Returns null
 * for a wall time that does not exist on the date (the spring-forward gap):
 * Luxon shifts a nonexistent local time forward, so the requested hour/minute
 * fails to round-trip.
 */
function projectStart(
  dayStart: DateTime,
  absMinute: number,
  hostTimezone: string,
): DateTime | null {
  const dt = projectBoundary(dayStart, absMinute, hostTimezone);
  const minuteOfDay = ((absMinute % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const wantHour = Math.floor(minuteOfDay / 60);
  const wantMinute = minuteOfDay % 60;
  if (dt.hour !== wantHour || dt.minute !== wantMinute) {
    return null;
  }
  return dt;
}

/**
 * Project a wall time to an instant without the existence check, for window
 * boundaries. Ambiguous times (fall-back) resolve to the earlier offset, which
 * is Luxon's default.
 */
function projectBoundary(
  dayStart: DateTime,
  absMinute: number,
  hostTimezone: string,
): DateTime {
  const dayOffset = Math.floor(absMinute / MINUTES_PER_DAY);
  const minuteOfDay = ((absMinute % MINUTES_PER_DAY) + MINUTES_PER_DAY) %
    MINUTES_PER_DAY;
  const nominal = dayStart.plus({ days: dayOffset });
  return DateTime.fromObject(
    {
      year: nominal.year,
      month: nominal.month,
      day: nominal.day,
      hour: Math.floor(minuteOfDay / 60),
      minute: minuteOfDay % 60,
    },
    { zone: hostTimezone },
  );
}

function windowStarts(
  dayStart: DateTime,
  window: ResolvedWindow,
  durationMin: number,
  hostTimezone: string,
): DateTime[] {
  const endAbs =
    window.endMinute > window.startMinute
      ? window.endMinute
      : window.endMinute + MINUTES_PER_DAY;
  const windowEnd = projectBoundary(dayStart, endAbs, hostTimezone);
  const starts: DateTime[] = [];
  // Step candidate starts by the duration in wall-clock minutes.
  for (let m = window.startMinute; m + durationMin <= endAbs; m += durationMin) {
    const start = projectStart(dayStart, m, hostTimezone);
    if (!start) continue;
    const end = start.plus({ minutes: durationMin });
    // Real elapsed time can shrink a window across a spring-forward; drop
    // candidates whose end runs past the window's real end instant.
    if (end.toMillis() > windowEnd.toMillis()) continue;
    starts.push(start);
  }
  return starts;
}

function overlapsBlock(
  blockStart: DateTime,
  blockEnd: DateTime,
  blocks: BlockRange[],
): boolean {
  const bs = blockStart.toMillis();
  const be = blockEnd.toMillis();
  // Half-open ranges: touching (end == start) does not overlap.
  return blocks.some(
    (b) => bs < b.endUtc.getTime() && b.startUtc.getTime() < be,
  );
}

/**
 * Generate all open slots whose starts fall on the given host-local dates,
 * filtered by minimum notice, the max-days-ahead horizon, and existing booked
 * block ranges. Slots are returned de-duplicated and sorted ascending by start.
 */
export function generateSlots(query: SlotQuery, hostDates: string[]): Slot[] {
  const {
    eventType,
    hostTimezone,
    rules,
    overrides,
    blackouts,
    blocks,
    now,
  } = query;

  const noticeCutoff = DateTime.fromJSDate(now).plus({
    minutes: eventType.minNoticeMin,
  });
  const todayHost = DateTime.fromJSDate(now).setZone(hostTimezone).startOf("day");
  const horizon = todayHost.plus({ days: eventType.maxDaysAhead });

  const seen = new Set<string>();
  const collected: { start: DateTime; end: DateTime }[] = [];

  for (const hostDate of hostDates) {
    const dayStart = DateTime.fromISO(hostDate, {
      zone: hostTimezone,
    }).startOf("day");
    if (!dayStart.isValid) continue;

    const windows = resolveWindows(
      hostDate,
      toWeekdayIndex(dayStart),
      rules,
      overrides,
      blackouts,
    );

    for (const window of windows) {
      for (const start of windowStarts(
        dayStart,
        window,
        eventType.durationMin,
        hostTimezone,
      )) {
        if (start.toMillis() < noticeCutoff.toMillis()) continue;

        const startHostDate = start.setZone(hostTimezone).startOf("day");
        if (startHostDate.toMillis() > horizon.toMillis()) continue;

        const end = start.plus({ minutes: eventType.durationMin });
        const blockStart = start.minus({ minutes: eventType.bufferBeforeMin });
        const blockEnd = end.plus({ minutes: eventType.bufferAfterMin });
        if (overlapsBlock(blockStart, blockEnd, blocks)) continue;

        const iso = utcIso(start);
        if (seen.has(iso)) continue;
        seen.add(iso);
        collected.push({ start, end });
      }
    }
  }

  collected.sort((a, b) => a.start.toMillis() - b.start.toMillis());
  return collected.map((s) => ({
    startUtc: utcIso(s.start),
    endUtc: utcIso(s.end),
  }));
}

/**
 * Host-local dates to scan to cover a visitor-local date range. A visitor date
 * can intersect two host dates, and midnight-crossing windows spill from the
 * previous host day, so pad one host day on each side.
 */
function hostDateSpan(
  visitorFrom: string,
  visitorTo: string,
  visitorTimezone: string,
  hostTimezone: string,
): string[] {
  const from = DateTime.fromISO(visitorFrom, { zone: visitorTimezone }).startOf(
    "day",
  );
  const to = DateTime.fromISO(visitorTo, { zone: visitorTimezone }).endOf("day");
  let cursor = from.setZone(hostTimezone).startOf("day").minus({ days: 1 });
  const end = to.setZone(hostTimezone).startOf("day").plus({ days: 1 });
  const dates: string[] = [];
  while (cursor.toMillis() <= end.toMillis()) {
    const iso = cursor.toISODate();
    if (iso) dates.push(iso);
    cursor = cursor.plus({ days: 1 });
  }
  return dates;
}

/** Slots whose start falls on `visitorDate` in the visitor's timezone. */
export function slotsForDay(
  query: SlotQuery,
  visitorTimezone: string,
  visitorDate: string,
): Slot[] {
  const hostDates = hostDateSpan(
    visitorDate,
    visitorDate,
    visitorTimezone,
    query.hostTimezone,
  );
  return generateSlots(query, hostDates).filter(
    (slot) =>
      DateTime.fromISO(slot.startUtc, { zone: "utc" })
        .setZone(visitorTimezone)
        .toISODate() === visitorDate,
  );
}

/** For each visitor-local date in `month` (YYYY-MM), whether it has any slot. */
export function daysForMonth(
  query: SlotQuery,
  visitorTimezone: string,
  month: string,
): DayAvailability[] {
  const first = DateTime.fromISO(`${month}-01`, {
    zone: visitorTimezone,
  }).startOf("day");
  const last = first.endOf("month");
  const hostDates = hostDateSpan(
    first.toISODate() ?? "",
    last.toISODate() ?? "",
    visitorTimezone,
    query.hostTimezone,
  );

  const withSlots = new Set<string>();
  for (const slot of generateSlots(query, hostDates)) {
    const date = DateTime.fromISO(slot.startUtc, { zone: "utc" })
      .setZone(visitorTimezone)
      .toISODate();
    if (date) withSlots.add(date);
  }

  const days: DayAvailability[] = [];
  const total = first.daysInMonth ?? 0;
  for (let i = 0; i < total; i += 1) {
    const date = first.plus({ days: i }).toISODate();
    if (date) days.push({ date, hasSlots: withSlots.has(date) });
  }
  return days;
}
