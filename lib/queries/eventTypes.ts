import { prisma } from "@/lib/db";
import type { IntakeQuestionInput } from "@/lib/validation/eventType";

export interface EventTypeSummary {
  slug: string;
  name: string;
  description: string;
  durationMin: number;
}

/** Active event types for the public booking list, ordered by name. */
export async function listActiveEventTypes(): Promise<EventTypeSummary[]> {
  const eventTypes = await prisma.eventType.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { slug: true, name: true, description: true, durationMin: true },
  });
  return eventTypes;
}

const EVENT_TYPE_SELECT = {
  id: true,
  name: true,
  slug: true,
  description: true,
  durationMin: true,
  bufferBeforeMin: true,
  bufferAfterMin: true,
  minNoticeMin: true,
  maxDaysAhead: true,
  reminderLeadMin: true,
  active: true,
  questions: {
    orderBy: { order: "asc" },
    select: {
      id: true,
      label: true,
      type: true,
      required: true,
      order: true,
      options: true,
    },
  },
} as const;

// Shared select for API responses; identical to the dashboard select.
export const EVENT_TYPE_RESPONSE_SELECT = EVENT_TYPE_SELECT;

export interface IntakeQuestionRecord {
  id: string;
  label: string;
  type: string;
  required: boolean;
  order: number;
  options: string[];
}

/**
 * Map validated questions to nested Prisma create rows, freezing display order
 * to the submitted array index so the host's ordering is authoritative.
 */
export function questionCreateRows(questions: IntakeQuestionInput[]) {
  return questions.map((question, index) => ({
    label: question.label,
    type: question.type,
    required: question.required,
    order: index,
    options: question.type === "single_choice" ? question.options : [],
  }));
}

export type EventTypeRecord = {
  id: string;
  name: string;
  slug: string;
  description: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
  reminderLeadMin: number;
  active: boolean;
  questions: IntakeQuestionRecord[];
};

/** All event types for the host dashboard, including inactive ones. */
export async function listAllEventTypes(
  hostId: string,
): Promise<EventTypeRecord[]> {
  return prisma.eventType.findMany({
    where: { hostId },
    orderBy: { name: "asc" },
    select: EVENT_TYPE_SELECT,
  });
}

/** One event type owned by the host, or null. */
export async function getEventTypeById(
  id: string,
  hostId: string,
): Promise<EventTypeRecord | null> {
  return prisma.eventType.findFirst({
    where: { id, hostId },
    select: EVENT_TYPE_SELECT,
  });
}
