import { ManagePanel } from "@/components/manage/ManagePanel";

export default async function ManageBookingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="mx-auto max-w-2xl px-4 py-12 md:px-6">
      <ManagePanel token={token} />
    </main>
  );
}
