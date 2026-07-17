import { NextResponse } from "next/server";
import { cancelBooking } from "@/lib/bookings/cancel";
import { prisma } from "@/lib/db";
import {
  handleRouteError,
  notFound,
  unauthorized,
  validationError,
} from "@/lib/errors";
import { getSessionHost } from "@/lib/queries/host";
import { cancelSchema } from "@/lib/validation/booking";
import { zodToFields } from "@/lib/validation/common";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();

    const { id } = await params;
    const booking = await prisma.booking.findUnique({
      where: { id },
      select: { hostId: true },
    });
    if (!booking || booking.hostId !== host.id) throw notFound();

    const body: unknown = await request.json().catch(() => ({}));
    const parsed = cancelSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw validationError(zodToFields(parsed.error));
    }

    const result = await cancelBooking(id, {
      reason: parsed.data.reason,
      cancelledBy: "host",
    });
    return NextResponse.json(result);
  } catch (error) {
    return handleRouteError(error, "api.host.bookings.cancel");
  }
}
