import { notFound } from "next/navigation";
import { BookingPage } from "@/components/booking/BookingPage";
import { getActiveEventType } from "@/lib/queries/availability";

export const dynamic = "force-dynamic";

export default async function EventBookingPage({
  params,
}: {
  params: Promise<{ eventTypeSlug: string }>;
}) {
  const { eventTypeSlug } = await params;
  const eventType = await getActiveEventType(eventTypeSlug);
  if (!eventType) notFound();

  return (
    <main className="mx-auto max-w-[960px] px-4 py-10 md:px-6">
      <BookingPage
        eventType={{
          slug: eventType.slug,
          name: eventType.name,
          description: eventType.description,
          durationMin: eventType.config.durationMin,
        }}
      />
    </main>
  );
}
