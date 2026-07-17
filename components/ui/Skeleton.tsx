interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-sm bg-surface-2 motion-reduce:animate-none ${className}`}
      aria-hidden="true"
    />
  );
}
