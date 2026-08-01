import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TEXT_TOKENS } from "@/design";

/**
 * SectionHeader (UI.1.2) — cabeçalho leve de seção interna.
 * Sem borda, sem card: apenas título, descrição e ações.
 */
export interface SectionHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className={cn("truncate font-semibold tracking-tight", TEXT_TOKENS.sm)}>
          {title}
        </h2>
        {description ? (
          <p className={cn("text-muted-foreground", TEXT_TOKENS.xs)}>{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div
          data-testid="section-header-actions"
          className="flex shrink-0 items-center gap-2"
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
