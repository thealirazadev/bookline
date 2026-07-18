import Link from "next/link";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/components/dashboard/SignOutButton";
import { getSessionHost } from "@/lib/queries/host";

const NAV = [
  { href: "/dashboard", label: "Bookings" },
  { href: "/dashboard/event-types", label: "Event types" },
  { href: "/dashboard/availability", label: "Availability" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const host = await getSessionHost();
  if (!host) redirect("/login");

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 md:px-6">
          <span className="font-bold">Bookline</span>
          <nav aria-label="Dashboard" className="flex items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-2 text-sm font-medium text-fg-muted hover:bg-surface-2 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
              >
                {item.label}
              </Link>
            ))}
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6">{children}</main>
    </div>
  );
}
