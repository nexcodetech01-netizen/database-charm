import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RADIUS_TOKENS, SPACING_TOKENS, TEXT_TOKENS } from "@/design";

/**
 * PageHeader (UI.1.2) — cabeçalho de página do Design System NexOS.
 *
 * Substitui headers manuais em telas novas. Puramente visual.
 */
export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  /** Slot livre abaixo do bloco principal (badges, filtros, KPIs). */
  extra?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function PageHeader({
  title,
  description,
  breadcrumb,
  actions,
  extra,
  icon: Icon,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn(SPACING_TOKENS.normal.stack, className)}>
      {breadcrumb ? <div data-testid="page-header-breadcrumb">{breadcrumb}</div> : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          {Icon ? (
            <span
              aria-hidden="true"
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center bg-accent text-primary",
                RADIUS_TOKENS.lg,
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          <div className="min-w-0 space-y-1">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-foreground">
              {title}
            </h1>
            {description ? (
              <p className={cn("text-muted-foreground", TEXT_TOKENS.sm)}>{description}</p>
            ) : null}
          </div>
        </div>

        {actions ? (
          <div
            data-testid="page-header-actions"
            className="flex shrink-0 flex-wrap items-center gap-2"
          >
            {actions}
          </div>
        ) : null}
      </div>

      {extra ? <div data-testid="page-header-extra">{extra}</div> : null}
    </header>
  );
}
