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
