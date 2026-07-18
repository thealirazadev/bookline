import { prisma } from "@/lib/db";

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
} as const;

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
