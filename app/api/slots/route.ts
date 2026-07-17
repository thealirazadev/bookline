import { NextResponse } from "next/server";
import { handleRouteError, notFound, validationError } from "@/lib/errors";
import {
  buildSlotQuery,
  getActiveEventType,
} from "@/lib/queries/availability";
import { slotsForDay } from "@/lib/slots/engine";
import { slotsQuerySchema } from "@/lib/validation/booking";
import { zodToFields } from "@/lib/validation/common";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = slotsQuerySchema.safeParse({
      eventType: searchParams.get("eventType"),
      date: searchParams.get("date"),
      tz: searchParams.get("tz"),
    });
    if (!parsed.success) {
      throw validationError(zodToFields(parsed.error));
    }

    const eventType = await getActiveEventType(parsed.data.eventType);
    if (!eventType) throw notFound();

    const slotQuery = await buildSlotQuery(eventType, new Date());
    const slots = slotsForDay(slotQuery, parsed.data.tz, parsed.data.date);

    return NextResponse.json({
      date: parsed.data.date,
      timezone: parsed.data.tz,
      slots,
    });
  } catch (error) {
    return handleRouteError(error, "api.slots");
  }
}
