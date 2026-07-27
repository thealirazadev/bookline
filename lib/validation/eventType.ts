import { z } from "zod";
import { slugSchema } from "./common";

export const QUESTION_TYPES = [
  "short_text",
  "long_text",
  "single_choice",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// Length caps for stored answers, enforced again server-side per question type.
export const SHORT_TEXT_MAX = 200;
export const LONG_TEXT_MAX = 2000;

export const MAX_QUESTIONS = 25;
export const MAX_CHOICE_OPTIONS = 20;

export const intakeQuestionInputSchema = z
  .object({
    label: z
      .string()
      .trim()
      .min(1, { message: "Enter a question." })
      .max(SHORT_TEXT_MAX),
    type: z.enum(QUESTION_TYPES, { message: "Pick a question type." }),
    required: z.boolean().default(false),
    options: z
      .array(z.string().trim().min(1).max(SHORT_TEXT_MAX))
      .max(MAX_CHOICE_OPTIONS)
      .default([]),
  })
  .superRefine((question, ctx) => {
    if (question.type === "single_choice") {
      if (question.options.length < 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Add at least two options.",
        });
      }
      const unique = new Set(question.options);
      if (unique.size !== question.options.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["options"],
          message: "Options must be unique.",
        });
      }
    } else if (question.options.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["options"],
        message: "Options apply to single choice only.",
      });
    }
  });

export const questionsSchema = z
  .array(intakeQuestionInputSchema)
  .max(MAX_QUESTIONS);

export type IntakeQuestionInput = z.infer<typeof intakeQuestionInputSchema>;

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
  questions: questionsSchema.optional(),
});

export const eventTypePatchSchema = eventTypeCreateSchema.partial();

export type EventTypeCreateInput = z.infer<typeof eventTypeCreateSchema>;
export type EventTypePatchInput = z.infer<typeof eventTypePatchSchema>;
