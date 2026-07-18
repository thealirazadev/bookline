import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleRouteError, unauthorized, validationError } from "@/lib/errors";
import { getOverrides } from "@/lib/queries/availability";
import { getSessionHost } from "@/lib/queries/host";
import {
  findWindowOverlap,
  overridesSchema,
} from "@/lib/validation/availability";
import { zodToFields } from "@/lib/validation/common";

export async function GET(): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();
    const overrides = await getOverrides(host.id);
    return NextResponse.json({ overrides });
  } catch (error) {
    return handleRouteError(error, "api.host.overrides.get");
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();

    const body: unknown = await request.json().catch(() => null);
    const parsed = overridesSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(zodToFields(parsed.error));
    }
    if (findWindowOverlap(parsed.data.windows)) {
      throw validationError({ windows: "Windows overlap on this date." });
    }

    await prisma.$transaction(async (tx) => {
      await tx.dateOverride.deleteMany({
        where: { hostId: host.id, date: parsed.data.date },
      });
      if (parsed.data.windows.length > 0) {
        await tx.dateOverride.createMany({
          data: parsed.data.windows.map((window) => ({
            hostId: host.id,
            date: parsed.data.date,
            startMinute: window.startMinute,
            endMinute: window.endMinute,
          })),
        });
      }
    });

    const overrides = await getOverrides(host.id);
    return NextResponse.json({ overrides });
  } catch (error) {
    return handleRouteError(error, "api.host.overrides.post");
  }
}
