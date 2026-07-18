import { z } from "zod";
import { slugSchema } from "./common";

export const eventTypeCreateSchema = z.object({
  name: z.string().trim().min(1, { message: "Enter a name." }).max(200),
  slug: slugSchema,
  description: z.string().trim().max(2000).default(""),
  durationMin: z
    .number()
    .int()
    .positive({ message: "Duration must be greater than 0." }),
  bufferBeforeMin: z
    .number()
    .int()
    .min(0, { message: "Buffer cannot be negative." }),
  bufferAfterMin: z
    .number()
    .int()
    .min(0, { message: "Buffer cannot be negative." }),
  minNoticeMin: z
    .number()
    .int()
    .min(0, { message: "Minimum notice cannot be negative." }),
  maxDaysAhead: z
    .number()
    .int()
    .min(1, { message: "Max days ahead must be at least 1." }),
  reminderLeadMin: z
    .number()
    .int()
    .min(0, { message: "Reminder lead cannot be negative." }),
  active: z.boolean().default(true),
});

export const eventTypePatchSchema = eventTypeCreateSchema.partial();

export type EventTypeCreateInput = z.infer<typeof eventTypeCreateSchema>;
export type EventTypePatchInput = z.infer<typeof eventTypePatchSchema>;
