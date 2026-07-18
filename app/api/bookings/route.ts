import { NextResponse } from "next/server";
import { createBooking } from "@/lib/bookings/create";
import { handleRouteError, validationError } from "@/lib/errors";
import { createBookingSchema } from "@/lib/validation/booking";
import { zodToFields } from "@/lib/validation/common";

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const body: unknown = await request.json().catch(() => null);
    const parsed = createBookingSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(zodToFields(parsed.error));
    }

    const result = await createBooking(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleRouteError(error, "api.bookings.create");
  }
}
