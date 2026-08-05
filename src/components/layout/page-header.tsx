import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Standard page header used across NexOS modules.
 * Supports an optional leading icon and a meta slot (badges/counters) rendered
 * next to the title. Actions align to the right on wide screens and drop
 * below on narrow ones.
 */
export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  icon?: LucideIcon;
  meta?: ReactNode;
  /** Se true, renderiza meta discretamente na mesma linha do título. */
  compactMeta?: boolean;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  icon: Icon,
  meta,
  compactMeta,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary sm:h-8 sm:w-8"
            aria-hidden="true"
          >
            <Icon className="h-5 w-5 sm:h-4 sm:w-4" />
          </div>
        ) : null}
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <h1 className="truncate text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {title}
            </h1>
            {meta && compactMeta ? (
              <div className="flex items-center text-xs font-normal text-muted-foreground before:mr-2 before:content-['•']">
                {meta}
              </div>
            ) : null}
          </div>
          {meta && !compactMeta ? <div className="flex items-center gap-2">{meta}</div> : null}
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
