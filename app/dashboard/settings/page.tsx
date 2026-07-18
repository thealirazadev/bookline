import { redirect } from "next/navigation";
import { CopyField } from "@/components/dashboard/CopyField";
import { env } from "@/lib/env";
import { getSessionHost } from "@/lib/queries/host";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const host = await getSessionHost();
  if (!host) redirect("/login");

  const feedUrl = `${env.APP_BASE_URL.replace(/\/$/, "")}/api/ical/${host.feedToken}`;

  return (
    <section className="flex max-w-2xl flex-col gap-6">
      <h1 className="text-[1.75rem] font-bold leading-tight">Settings</h1>

      <dl className="grid grid-cols-1 gap-4 rounded-md border border-border bg-surface p-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-fg-muted">Name</dt>
          <dd className="font-medium">{host.name}</dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">Email</dt>
          <dd className="font-medium">{host.email}</dd>
        </div>
        <div>
          <dt className="text-sm text-fg-muted">Timezone</dt>
          <dd className="font-medium">{host.timezone}</dd>
        </div>
      </dl>

      <div className="rounded-md border border-border bg-surface p-4">
        <h2 className="text-[1.25rem] font-semibold">Calendar feed</h2>
        <p className="mt-1 mb-3 text-sm text-fg-muted">
          Subscribe any calendar app to this read-only feed of your confirmed
          bookings. Keep the URL private; anyone with it can see your bookings.
        </p>
        <CopyField label="iCal feed URL" value={feedUrl} />
      </div>
    </section>
  );
}
