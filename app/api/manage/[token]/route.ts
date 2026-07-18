import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { handleRouteError, notFound, tokenInvalid } from "@/lib/errors";
import { getManageBookingView } from "@/lib/queries/bookings";
import { verifyManageToken } from "@/lib/tokens";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  try {
    const { token } = await params;
    const bookingId = verifyManageToken(token, env.LINK_TOKEN_SECRET);
    if (!bookingId) throw tokenInvalid();

    const view = await getManageBookingView(bookingId);
    if (!view) throw notFound();

    return NextResponse.json(view);
  } catch (error) {
    return handleRouteError(error, "api.manage.get");
  }
}
