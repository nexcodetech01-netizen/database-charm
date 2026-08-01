import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SPACING_TOKENS,
  TEXT_TOKENS,
  statusToken,
  type StatusToken,
} from "@/design";

/**
 * HeroMetric (UI.2.1) — KPI principal da Home.
 *
 * Puramente apresentacional: recebe valores já formatados pelo chamador.
 * Nenhum hook, serviço, query ou cálculo. Existe apenas para criar a
 * hierarquia visual pedida no EPIC UI.2 (um KPI domina a tela).
 */
export interface HeroMetricProps {
  label: ReactNode;
  value?: ReactNode;
  caption?: ReactNode;
  icon?: LucideIcon;
  status?: StatusToken;
  /** Indicadores secundários exibidos à direita do valor. */
  side?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function HeroMetric({
  label,
  value,
  caption,
  icon: Icon,
  status = "info",
  side,
  loading = false,
  className,
}: HeroMetricProps) {
  const token = statusToken(status);

  return (
    <section
      data-testid="hero-metric"
      data-status={status}
      className={cn(
        "border border-border bg-card text-card-foreground",
        RADIUS_TOKENS.xl,
        SHADOW_TOKENS.floating,
        SPACING_TOKENS.relaxed.padding,
        "grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center",
        className,
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3">
          {Icon ? (
            <span
              aria-hidden="true"
              data-testid="hero-metric-icon"
              className={cn(
                "grid h-10 w-10 shrink-0 place-items-center",
                RADIUS_TOKENS.lg,
                token.soft,
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
          ) : null}
          <p
            className={cn(
              "min-w-0 truncate font-medium uppercase tracking-wide text-muted-foreground",
              TEXT_TOKENS.xs,
            )}
          >
            {label}
          </p>
        </div>

        <div className="mt-4">
          {loading ? (
            <Skeleton data-testid="hero-metric-skeleton" className="h-12 w-64" />
          ) : (
            <p
              data-testid="hero-metric-value"
              className="truncate text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl"
            >
              {value ?? "—"}
            </p>
          )}
        </div>

        {!loading && caption ? (
          <p className={cn("mt-2 text-muted-foreground", TEXT_TOKENS.sm)}>{caption}</p>
        ) : null}
      </div>

      {side ? (
        <div data-testid="hero-metric-side" className="min-w-0 lg:w-72">
          {side}
        </div>
      ) : null}
    </section>
  );
}
