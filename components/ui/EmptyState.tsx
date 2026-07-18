import type { ReactNode } from "react";

interface EmptyStateProps {
  heading: string;
  message?: string;
  action?: ReactNode;
}

export function EmptyState({ heading, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border bg-surface px-6 py-10 text-center">
      <p className="font-medium text-fg">{heading}</p>
      {message ? <p className="text-sm text-fg-muted">{message}</p> : null}
      {action}
    </div>
  );
}
