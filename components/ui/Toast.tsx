"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  onClose: () => void;
}

export function Toast({ message, onClose }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-4 z-50 mx-auto flex max-w-md items-start justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 shadow-overlay"
    >
      <p className="text-sm text-fg">{message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="rounded-sm px-1 text-fg-muted hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        &times;
      </button>
    </div>
  );
}
