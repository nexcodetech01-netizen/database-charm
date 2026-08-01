import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { RADIUS_TOKENS, TEXT_TOKENS, statusToken, type StatusToken } from "@/design";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * InsightCards (UI.2.1) — cards de insight enxutos da Home.
 *
 * Somente apresentação: recebe uma lista já pronta. Nenhuma regra, cálculo,
 * hook ou serviço. Substitui blocos de texto longos por leitura rápida.
 */
export interface InsightCardItem {
  id: string;
  label: ReactNode;
  value?: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  status?: StatusToken;
}

export interface InsightCardsProps {
  items: InsightCardItem[];
  loading?: boolean;
  emptyMessage?: ReactNode;
  className?: string;
}

export function InsightCards({
  items,
  loading = false,
  emptyMessage = "Sem insights no momento.",
  className,
}: InsightCardsProps) {
  if (loading) {
    return (
      <div data-testid="insight-cards-loading" className={cn("grid gap-3 sm:grid-cols-2", className)}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <p
        data-testid="insight-cards-empty"
        className={cn("py-6 text-center text-muted-foreground", TEXT_TOKENS.sm)}
      >
        {emptyMessage}
      </p>
    );
  }

  return (
    <div data-testid="insight-cards" className={cn("grid gap-3 sm:grid-cols-2", className)}>
      {items.map((item) => {
        const Icon = item.icon;
        const token = statusToken(item.status ?? "neutral");
        return (
          <div
            key={item.id}
            data-testid="insight-card"
            className={cn(
              "flex min-w-0 items-start gap-3 border border-border/60 bg-muted/20 p-3",
              RADIUS_TOKENS.lg,
            )}
          >
            {Icon ? (
              <span
                aria-hidden="true"
                className={cn(
                  "grid h-8 w-8 shrink-0 place-items-center",
                  RADIUS_TOKENS.lg,
                  token.soft,
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
            ) : null}
            <div className="min-w-0">
              <p className={cn("truncate font-medium", TEXT_TOKENS.sm)}>{item.label}</p>
              {item.value ? (
                <p className={cn("truncate font-semibold tabular-nums", TEXT_TOKENS.base)}>
                  {item.value}
                </p>
              ) : null}
              {item.hint ? (
                <p className={cn("truncate text-muted-foreground", TEXT_TOKENS.xs)}>
                  {item.hint}
                </p>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
