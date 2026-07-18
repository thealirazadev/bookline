import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { listAllEventTypes } from "@/lib/queries/eventTypes";
import { getSessionHost } from "@/lib/queries/host";

export const dynamic = "force-dynamic";

export default async function EventTypesPage() {
  const host = await getSessionHost();
  if (!host) redirect("/login");

  const eventTypes = await listAllEventTypes(host.id);

  return (
    <section className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[1.75rem] font-bold leading-tight">Event types</h1>
        <Link
          href="/dashboard/event-types/new"
          className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          New event type
        </Link>
      </div>

      {eventTypes.length === 0 ? (
        <EmptyState
          heading="Create your first event type"
          message="Define what visitors can book and where it appears publicly."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {eventTypes.map((eventType) => (
            <li key={eventType.id}>
              <Link
                href={`/dashboard/event-types/${eventType.id}`}
                className="flex items-center justify-between rounded-md border border-border bg-surface p-4 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <span>
                  <span className="font-medium">{eventType.name}</span>
                  <span className="ml-2 text-sm text-fg-muted">
                    /{eventType.slug} &middot; {eventType.durationMin} min
                  </span>
                </span>
                <Badge tone={eventType.active ? "confirmed" : "cancelled"}>
                  {eventType.active ? "active" : "inactive"}
                </Badge>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
