import { Skeleton } from "@/components/ui/Skeleton";

export default function BookLoading() {
  return (
    <main className="mx-auto max-w-[960px] px-4 py-10 md:px-6">
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="flex flex-col gap-4 md:w-2/5">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-20" />
          <Skeleton className="h-11" />
        </div>
        <div className="flex flex-col gap-4 md:w-3/5">
          <Skeleton className="h-64" />
        </div>
      </div>
    </main>
  );
}
