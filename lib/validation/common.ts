import { IANAZone } from "luxon";
import { z } from "zod";

/** Probe a timezone string against the platform IANA data via Luxon. */
export function isValidTimezone(timezone: string): boolean {
  return IANAZone.isValidZone(timezone);
}

export const timezoneSchema = z
  .string()
  .refine(isValidTimezone, { message: "Enter a valid timezone." });

export const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, { message: "Enter a valid event type." });

export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "Enter a valid date (YYYY-MM-DD)." });

export const monthSchema = z
  .string()
  .regex(/^\d{4}-\d{2}$/, { message: "Enter a valid month (YYYY-MM)." });

export const isoInstantSchema = z
  .string()
  .datetime({ message: "Enter a valid time." });

/** Reduce a Zod error to one message per field, for the API error `fields`. */
export function zodToFields(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
