import type { SelectHTMLAttributes } from "react";
import { useId } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  hint?: string;
}

export function Select({
  label,
  hint,
  className = "",
  id,
  children,
  ...props
}: SelectProps) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const hintId = `${selectId}-hint`;

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={selectId} className="text-sm font-medium text-fg">
        {label}
      </label>
      <select
        {...props}
        id={selectId}
        aria-describedby={hint ? hintId : undefined}
        className={`min-h-[44px] rounded-sm border border-border bg-bg px-3 py-2 text-fg outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-focus-ring ${className}`}
      >
        {children}
      </select>
      {hint ? (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
