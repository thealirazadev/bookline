import Link from "next/link";
import { EmptyState } from "@/components/ui/EmptyState";
import { listActiveEventTypes } from "@/lib/queries/eventTypes";

export const dynamic = "force-dynamic";

export default async function BookIndexPage() {
  const eventTypes = await listActiveEventTypes();

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <h1 className="text-[1.75rem] font-bold leading-tight">Book a time</h1>
      <p className="mt-1 text-fg-muted">Choose what you would like to book.</p>

      {eventTypes.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            heading="Nothing to book yet"
            message="There are no active event types right now."
          />
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {eventTypes.map((eventType) => (
            <li key={eventType.slug}>
              <Link
                href={`/book/${eventType.slug}`}
                className="block rounded-md border border-border bg-surface p-4 shadow-card transition-colors hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                <span className="font-medium text-fg">{eventType.name}</span>
                <span className="ml-2 text-sm text-fg-muted">
                  {eventType.durationMin} min
                </span>
                {eventType.description ? (
                  <p className="mt-1 text-sm text-fg-muted">
                    {eventType.description}
                  </p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
