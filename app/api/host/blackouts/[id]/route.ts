import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { handleRouteError, notFound, unauthorized } from "@/lib/errors";
import { getSessionHost } from "@/lib/queries/host";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const host = await getSessionHost();
    if (!host) throw unauthorized();

    const { id } = await params;
    const existing = await prisma.blackoutDate.findFirst({
      where: { id, hostId: host.id },
      select: { id: true },
    });
    if (!existing) throw notFound();

    await prisma.blackoutDate.delete({ where: { id } });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return handleRouteError(error, "api.host.blackouts.delete");
  }
}
