import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Standard toolbar for listing pages: places a search/primary control on the
 * left, secondary filters in the middle, and actions on the right.
 * Responsive: stacks on small screens.
 */
export function SectionToolbar({
  search,
  filters,
  actions,
  className,
}: {
  search?: ReactNode;
  filters?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-lg border bg-card/60 p-3 sm:flex-row sm:flex-wrap sm:items-center",
        className,
      )}
    >
      {search ? <div className="min-w-0 flex-1 sm:max-w-sm">{search}</div> : null}
      {filters ? (
        <div className="flex flex-wrap items-center gap-2">{filters}</div>
      ) : null}
      {actions ? (
        <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
