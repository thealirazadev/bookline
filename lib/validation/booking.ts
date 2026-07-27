import { z } from "zod";
import {
  dateSchema,
  isoInstantSchema,
  monthSchema,
  slugSchema,
  timezoneSchema,
} from "./common";
import { LONG_TEXT_MAX } from "./eventType";

export const availabilityQuerySchema = z.object({
  eventType: slugSchema,
  month: monthSchema,
  tz: timezoneSchema,
});

export const slotsQuerySchema = z.object({
  eventType: slugSchema,
  date: dateSchema,
  tz: timezoneSchema,
});

export const createBookingSchema = z.object({
  eventType: slugSchema,
  startUtc: isoInstantSchema,
  name: z.string().trim().min(1, { message: "Enter your name." }).max(200),
  email: z
    .string()
    .trim()
    .email({ message: "Enter a valid email address." })
    .max(320),
  timezone: timezoneSchema,
  // Answers keyed by intake-question id. The wire ceiling is the longest
  // allowed answer; per-question rules (required, choice, exact cap) run in
  // createBooking against the event type's questions.
  answers: z.record(z.string(), z.string().max(LONG_TEXT_MAX)).optional(),
});

export const rescheduleSchema = z.object({
  startUtc: isoInstantSchema,
  timezone: timezoneSchema,
});

export const cancelSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type RescheduleInput = z.infer<typeof rescheduleSchema>;
export type CancelInput = z.infer<typeof cancelSchema>;
