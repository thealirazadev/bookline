import { redirect } from "next/navigation";
import { EventTypeForm } from "@/components/dashboard/EventTypeForm";
import { getSessionHost } from "@/lib/queries/host";

export default async function NewEventTypePage() {
  const host = await getSessionHost();
  if (!host) redirect("/login");

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-[1.75rem] font-bold leading-tight">New event type</h1>
      <EventTypeForm />
    </section>
  );
}
