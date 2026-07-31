import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Standard empty state used across NexOS modules.
 * Always provide a clear title, a helpful description, and (optionally)
 * a primary action so the user knows exactly what to do next.
 */
export interface EmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/50 px-6 py-16 text-center",
        className,
      )}
    >
      {Icon ? (
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon className="h-6 w-6" aria-hidden="true" />
        </div>
      ) : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}
