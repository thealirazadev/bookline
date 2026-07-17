import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-[1.75rem] font-bold leading-tight">Page not found</h1>
      <p className="text-fg-muted">
        The page you are looking for does not exist or has moved.
      </p>
      <Link
        href="/book"
        className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        Go to booking
      </Link>
    </main>
  );
}
