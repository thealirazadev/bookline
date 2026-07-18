import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  ApiError,
  handleRouteError,
  notFound,
  unauthorized,
  validationError,
} from "@/lib/errors";
import { getEventTypeById } from "@/lib/queries/eventTypes";
import { getSessionHost } from "@/lib/queries/host";
import { eventTypePatchSchema } from "@/lib/validation/eventType";
import { zodToFields } from "@/lib/validation/common";

const RESPONSE_SELECT = {
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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();

    const { id } = await params;
    const existing = await getEventTypeById(id, host.id);
    if (!existing) throw notFound();

    const body: unknown = await request.json().catch(() => null);
    const parsed = eventTypePatchSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(zodToFields(parsed.error));
    }

    if (parsed.data.slug && parsed.data.slug !== existing.slug) {
      const clash = await prisma.eventType.findUnique({
        where: { slug: parsed.data.slug },
        select: { id: true },
      });
      if (clash) throw validationError({ slug: "That slug is already in use." });
    }

    const eventType = await prisma.eventType.update({
      where: { id },
      data: parsed.data,
      select: RESPONSE_SELECT,
    });
    return NextResponse.json({ eventType });
  } catch (error) {
    return handleRouteError(error, "api.event-types.update");
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();

    const { id } = await params;
    const existing = await getEventTypeById(id, host.id);
    if (!existing) throw notFound();

    const bookingCount = await prisma.booking.count({
      where: { eventTypeId: id },
    });
    if (bookingCount > 0) {
      throw new ApiError("VALIDATION_ERROR", {
        status: 409,
        message: "This event type has bookings. Deactivate it instead.",
      });
    }

    await prisma.eventType.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleRouteError(error, "api.event-types.delete");
  }
}
