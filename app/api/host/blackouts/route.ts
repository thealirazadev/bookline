import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleRouteError, unauthorized, validationError } from "@/lib/errors";
import { getBlackouts } from "@/lib/queries/availability";
import { getSessionHost } from "@/lib/queries/host";
import { blackoutSchema } from "@/lib/validation/availability";
import { zodToFields } from "@/lib/validation/common";

export async function GET(): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();
    const blackouts = await getBlackouts(host.id);
    return NextResponse.json({ blackouts });
  } catch (error) {
    return handleRouteError(error, "api.host.blackouts.get");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();

    const body: unknown = await request.json().catch(() => null);
    const parsed = blackoutSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(zodToFields(parsed.error));
    }

    const existing = await prisma.blackoutDate.findUnique({
      where: { hostId_date: { hostId: host.id, date: parsed.data.date } },
      select: { id: true },
    });
    if (existing) {
      throw validationError({ date: "That date is already blacked out." });
    }

    await prisma.blackoutDate.create({
      data: { hostId: host.id, date: parsed.data.date },
    });

    const blackouts = await getBlackouts(host.id);
    return NextResponse.json({ blackouts });
  } catch (error) {
    return handleRouteError(error, "api.host.blackouts.post");
  }
}
