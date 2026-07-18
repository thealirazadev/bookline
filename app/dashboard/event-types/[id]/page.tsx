import { notFound, redirect } from "next/navigation";
import { EventTypeForm } from "@/components/dashboard/EventTypeForm";
import { getEventTypeById } from "@/lib/queries/eventTypes";
import { getSessionHost } from "@/lib/queries/host";

export const dynamic = "force-dynamic";

export default async function EditEventTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const host = await getSessionHost();
  if (!host) redirect("/login");

  const { id } = await params;
  const eventType = await getEventTypeById(id, host.id);
  if (!eventType) notFound();

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-[1.75rem] font-bold leading-tight">
        Edit {eventType.name}
      </h1>
      <EventTypeForm eventType={eventType} />
    </section>
  );
}
