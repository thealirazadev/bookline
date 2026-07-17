import { NextResponse } from "next/server";
import { handleRouteError, notFound, validationError } from "@/lib/errors";
import {
  buildSlotQuery,
  getActiveEventType,
} from "@/lib/queries/availability";
import { daysForMonth } from "@/lib/slots/engine";
import { availabilityQuerySchema } from "@/lib/validation/booking";
import { zodToFields } from "@/lib/validation/common";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = availabilityQuerySchema.safeParse({
      eventType: searchParams.get("eventType"),
      month: searchParams.get("month"),
      tz: searchParams.get("tz"),
    });
    if (!parsed.success) {
      throw validationError(zodToFields(parsed.error));
    }

    const eventType = await getActiveEventType(parsed.data.eventType);
    if (!eventType) throw notFound();

    const slotQuery = await buildSlotQuery(eventType, new Date());
    const days = daysForMonth(slotQuery, parsed.data.tz, parsed.data.month);

    return NextResponse.json({
      eventType: {
        slug: eventType.slug,
        name: eventType.name,
        durationMin: eventType.config.durationMin,
      },
      month: parsed.data.month,
      timezone: parsed.data.tz,
      days,
    });
  } catch (error) {
    return handleRouteError(error, "api.availability");
  }
}
