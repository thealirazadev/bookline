import { redirect } from "next/navigation";
import { BookingsTable } from "@/components/dashboard/BookingsTable";
import { listDashboardBookings } from "@/lib/queries/bookings";
import { getSessionHost } from "@/lib/queries/host";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const host = await getSessionHost();
  if (!host) redirect("/login");

  const { upcoming, past } = await listDashboardBookings(host.id);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="text-[1.75rem] font-bold leading-tight">Bookings</h1>
      <BookingsTable
        upcoming={upcoming}
        past={past}
        hostTimezone={host.timezone}
      />
    </section>
  );
}
