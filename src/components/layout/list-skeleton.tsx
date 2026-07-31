import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Reusable skeleton for tabular/list loading states.
 * Renders `rows` skeleton lines with an optional header bar to reduce
 * perceived latency during async loads.
 */
export function ListSkeleton({
  rows = 6,
  showHeader = true,
  className,
}: {
  rows?: number;
  showHeader?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)} aria-hidden="true">
      {showHeader ? <Skeleton className="h-9 w-full rounded-md" /> : null}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-md" />
      ))}
    </div>
  );
}

export function CardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid grid-cols-2 gap-3 md:grid-cols-4", className)}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-lg" />
      ))}
    </div>
  );
}
