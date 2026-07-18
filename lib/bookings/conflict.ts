import { Prisma } from "@prisma/client";

// The booking_no_overlap exclusion constraint (SQLSTATE 23P01) is the
// authoritative double-booking guard. Detect it across both the typed client
// path (unknown-request error carrying the message) and any raw path (known
// request error P2010 exposing meta.code).
export function isSlotConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const meta = error.meta as { code?: string; message?: string } | undefined;
    if (
      meta?.code === "23P01" ||
      (typeof meta?.message === "string" &&
        meta.message.includes("booking_no_overlap"))
    ) {
      return true;
    }
  }
  if (error instanceof Error) {
    return (
      error.message.includes("23P01") ||
      error.message.includes("booking_no_overlap")
    );
  }
  return false;
}
