import { redirect } from "next/navigation";
import { OverridesEditor } from "@/components/dashboard/OverridesEditor";
import { WeeklyRulesEditor } from "@/components/dashboard/WeeklyRulesEditor";
import {
  getBlackouts,
  getOverrides,
  getWeeklyRules,
} from "@/lib/queries/availability";
import { getSessionHost } from "@/lib/queries/host";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const host = await getSessionHost();
  if (!host) redirect("/login");

  const [rules, overrides, blackouts] = await Promise.all([
    getWeeklyRules(host.id),
    getOverrides(host.id),
    getBlackouts(host.id),
  ]);

  return (
    <section className="flex max-w-2xl flex-col gap-10">
      <div>
        <h1 className="text-[1.75rem] font-bold leading-tight">Availability</h1>
        <p className="mt-1 text-fg-muted">
          Weekly hours in your timezone ({host.timezone}).
        </p>
      </div>
      <WeeklyRulesEditor initialRules={rules} />
      <OverridesEditor
        initialOverrides={overrides}
        initialBlackouts={blackouts}
      />
    </section>
  );
}
