// Pure slot-engine types. Local-time fields are minutes-of-day in the host's
// timezone; all instants are UTC.

export interface EventTypeConfig {
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
}

export interface WeeklyRule {
  weekday: number; // 0 = Monday .. 6 = Sunday
  startMinute: number; // 0..1439
  endMinute: number; // 1..1440; endMinute <= startMinute crosses midnight
}

export interface DateOverrideInput {
  date: string; // host-local "YYYY-MM-DD"
  startMinute: number;
  endMinute: number;
}

export interface BlackoutInput {
  date: string; // host-local "YYYY-MM-DD"
}

/** An occupied UTC range from an existing confirmed booking (buffers included). */
export interface BlockRange {
  startUtc: Date;
  endUtc: Date;
}

export interface SlotQuery {
  eventType: EventTypeConfig;
  hostTimezone: string;
  rules: WeeklyRule[];
  overrides: DateOverrideInput[];
  blackouts: BlackoutInput[];
  blocks: BlockRange[];
  now: Date;
}

export interface Slot {
  startUtc: string; // ISO 8601 with Z suffix
  endUtc: string;
}

export interface DayAvailability {
  date: string; // visitor-local "YYYY-MM-DD"
  hasSlots: boolean;
}

/** A window resolved for one host-local date, in host wall-clock minutes. */
export interface ResolvedWindow {
  startMinute: number;
  endMinute: number;
}
