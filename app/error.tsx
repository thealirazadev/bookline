"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="w-full rounded-md border border-border bg-surface p-6 shadow-card">
        <h1 className="text-[1.25rem] font-semibold">Something went wrong</h1>
        <p className="mt-2 text-fg-muted">
          An unexpected error occurred. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
        >
          Try again
        </button>
      </div>
    </main>
  );
}
