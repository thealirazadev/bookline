"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-sm font-medium text-fg">{label}</span>
      <div className="flex gap-2">
        <input
          readOnly
          value={value}
          aria-label={label}
          onFocus={(e) => e.currentTarget.select()}
          className="min-h-[44px] flex-1 rounded-sm border border-border bg-surface px-3 py-2 text-sm text-fg-muted"
        />
        <Button variant="secondary" onClick={copy} aria-live="polite">
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
}
