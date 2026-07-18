import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleRouteError, unauthorized, validationError } from "@/lib/errors";
import { getSessionHost } from "@/lib/queries/host";
import { getWeeklyRules } from "@/lib/queries/availability";
import {
  WEEKDAY_NAMES,
  findWeeklyOverlap,
  weeklyRulesSchema,
} from "@/lib/validation/availability";
import { zodToFields } from "@/lib/validation/common";

export async function GET(): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();
    const rules = await getWeeklyRules(host.id);
    return NextResponse.json({ rules });
  } catch (error) {
    return handleRouteError(error, "api.host.availability.get");
  }
}

export async function PUT(request: Request): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();

    const body: unknown = await request.json().catch(() => null);
    const parsed = weeklyRulesSchema.safeParse(body);
    if (!parsed.success) {
      throw validationError(zodToFields(parsed.error));
    }

    const conflictWeekday = findWeeklyOverlap(parsed.data.rules);
    if (conflictWeekday !== null) {
      throw validationError({
        rules: `Windows overlap on ${WEEKDAY_NAMES[conflictWeekday]}.`,
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.availabilityRule.deleteMany({ where: { hostId: host.id } });
      if (parsed.data.rules.length > 0) {
        await tx.availabilityRule.createMany({
          data: parsed.data.rules.map((rule) => ({
            hostId: host.id,
            weekday: rule.weekday,
            startMinute: rule.startMinute,
            endMinute: rule.endMinute,
          })),
        });
      }
    });

    const rules = await getWeeklyRules(host.id);
    return NextResponse.json({ rules });
  } catch (error) {
    return handleRouteError(error, "api.host.availability.put");
  }
}
