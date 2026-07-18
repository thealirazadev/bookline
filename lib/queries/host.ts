import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** The authenticated host row, or null when there is no valid session. */
export async function getSessionHost() {
  const session = await auth();
  if (!session?.user?.id) return null;
  return prisma.host.findUnique({ where: { id: session.user.id } });
}
