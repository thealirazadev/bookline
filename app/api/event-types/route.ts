import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleRouteError, unauthorized, validationError } from "@/lib/errors";
import { getSessionHost } from "@/lib/queries/host";
import {
  EVENT_TYPE_RESPONSE_SELECT,
  questionCreateRows,
} from "@/lib/queries/eventTypes";
import { listAllEventTypes } from "@/lib/queries/eventTypes";
import { eventTypeCreateSchema } from "@/lib/validation/eventType";
import { zodToFields } from "@/lib/validation/common";

export async function GET(): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();
    const eventTypes = await listAllEventTypes(host.id);
    return NextResponse.json({ eventTypes });
  } catch (error) {
    return handleRouteError(error, "api.event-types.list");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();

    const body: unknown = await request.json().catch(() => null);
    const parsed = eventTypeCreateSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(zodToFields(parsed.error));
    }

    const existing = await prisma.eventType.findUnique({
      where: { slug: parsed.data.slug },
      select: { id: true },
    });
    if (existing) {
      throw validationError({ slug: "That slug is already in use." });
    }

    const { questions, ...scalars } = parsed.data;
    const eventType = await prisma.eventType.create({
      data: {
        ...scalars,
        hostId: host.id,
        questions: { create: questionCreateRows(questions ?? []) },
      },
      select: EVENT_TYPE_RESPONSE_SELECT,
    });
    return NextResponse.json({ eventType }, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "api.event-types.create");
  }
}
