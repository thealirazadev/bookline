import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildFeedCalendar } from "@/lib/ics/feed";
import { logger } from "@/lib/logger";
import { loadFeedBookings } from "@/lib/queries/bookings";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ feedToken: string }> },
): Promise<NextResponse> {
  const { feedToken } = await params;
  try {
    const host = await prisma.host.findUnique({
      where: { feedToken },
      select: { id: true, name: true },
    });
    // A wrong or missing token is an unguessable-URL miss: plain 404, no body.
    if (!host) {
      return new NextResponse("Not found", { status: 404 });
    }

    const bookings = await loadFeedBookings(host.id);
    const body = buildFeedCalendar(host.name, bookings);
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logger.error({
      event: "api.ical.feed",
      message: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse("Internal error", { status: 500 });
  }
}
