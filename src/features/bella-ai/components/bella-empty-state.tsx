import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RADIUS_TOKENS, TEXT_TOKENS, statusToken, type StatusToken } from "@/design";

/**
 * BellaEmptyState (UI.2.2) — empty state padrão da Bella.
 * Puramente visual: sem hooks, serviços ou regra de negócio.
 */
export interface BellaEmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  description?: ReactNode;
  status?: StatusToken;
  action?: ReactNode;
  className?: string;
}

export function BellaEmptyState({
  icon: Icon,
  title,
  description,
  status = "neutral",
  action,
  className,
}: BellaEmptyStateProps) {
  const token = statusToken(status);
  return (
    <div
      data-testid="bella-empty-state"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-10 text-center",
        className,
      )}
    >
      {Icon ? (
        <span
          aria-hidden="true"
          className={cn("grid h-10 w-10 place-items-center", RADIUS_TOKENS.lg, token.soft)}
        >
          <Icon className="h-5 w-5" />
        </span>
      ) : null}
      <p className={cn("font-medium", TEXT_TOKENS.sm)}>{title}</p>
      {description ? (
        <p className={cn("max-w-md text-muted-foreground", TEXT_TOKENS.xs)}>{description}</p>
      ) : null}
      {action}
    </div>
  );
}
