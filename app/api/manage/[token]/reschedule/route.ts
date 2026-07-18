import { NextResponse } from "next/server";
import { rescheduleBooking } from "@/lib/bookings/reschedule";
import { env } from "@/lib/env";
import { handleRouteError, tokenInvalid, validationError } from "@/lib/errors";
import { verifyManageToken } from "@/lib/tokens";
import { rescheduleSchema } from "@/lib/validation/booking";
import { zodToFields } from "@/lib/validation/common";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const bookingId = verifyManageToken(token, env.LINK_TOKEN_SECRET);
    if (!bookingId) throw tokenInvalid();

    const body: unknown = await request.json().catch(() => null);
    const parsed = rescheduleSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(zodToFields(parsed.error));
    }

    const result = await rescheduleBooking(bookingId, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "api.manage.reschedule");
  }
}
