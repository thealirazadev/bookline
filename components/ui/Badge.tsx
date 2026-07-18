type Tone = "confirmed" | "cancelled" | "pending";

const TONES: Record<Tone, string> = {
  confirmed: "bg-success/15 text-success",
  cancelled: "bg-danger/15 text-danger",
  pending: "bg-warning/15 text-warning",
};

export function Badge({ tone, children }: { tone: Tone; children: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${TONES[tone]}`}
    >
      {children}
    </span>
  );
}
