import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  TEXT_TOKENS,
  statusToken,
  type StatusToken,
} from "@/design";

/**
 * MetricCard (UI.1.2) — card de indicador do Design System NexOS.
 *
 * Puramente apresentacional: recebe valores já formatados. Nenhuma regra de
 * negócio, hook, serviço ou acesso a dados. Skeleton integrado.
 */
export interface MetricCardTrend {
  value: ReactNode;
  direction?: "up" | "down" | "flat";
  /** Intenção semântica — usa tokens de status, nunca cores cruas. */
  status?: StatusToken;
}

export interface MetricCardProps {
  title: ReactNode;
  value?: ReactNode;
  trend?: MetricCardTrend;
  icon?: LucideIcon;
  /** Token de status aplicado ao ícone/realce do card. */
  status?: StatusToken;
  footer?: ReactNode;
  loading?: boolean;
  className?: string;
}

export function MetricCard({
  title,
  value,
  trend,
  icon: Icon,
  status,
  footer,
  loading = false,
  className,
}: MetricCardProps) {
  const token = status ? statusToken(status) : null;

  return (
    <div
      data-status={status ?? "none"}
      data-loading={loading ? "true" : "false"}
      className={cn(
        "border border-border bg-card p-6 text-card-foreground",
        RADIUS_TOKENS.xl,
        SHADOW_TOKENS.card,
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={cn(
            "min-w-0 truncate font-medium uppercase tracking-wide text-muted-foreground",
            TEXT_TOKENS.xs,
          )}
        >
          {title}
        </p>
        {Icon ? (
          <span
            aria-hidden="true"
            data-testid="metric-card-icon"
            className={cn(
              "grid h-9 w-9 shrink-0 place-items-center",
              RADIUS_TOKENS.lg,
              token ? token.soft : "bg-accent text-primary",
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>

      <div className="mt-3">
        {loading ? (
          <Skeleton data-testid="metric-card-skeleton" className="h-8 w-28" />
        ) : (
          <p className="truncate text-2xl font-semibold tracking-tight tabular-nums">
            {value ?? "—"}
          </p>
        )}
      </div>

      {!loading && (trend || footer) ? (
        <div className={cn("mt-2 flex items-center gap-2", TEXT_TOKENS.xs)}>
          {trend ? <TrendPill {...trend} /> : null}
          {footer ? (
            <span className="truncate text-muted-foreground">{footer}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function TrendPill({ value, direction = "flat", status = "neutral" }: MetricCardTrend) {
  const Icon =
    direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : Minus;
  const token = statusToken(status);
  return (
    <span
      data-testid="metric-card-trend"
      data-direction={direction}
      className={cn(
        "inline-flex items-center gap-1 px-1.5 py-0.5 font-medium",
        RADIUS_TOKENS.sm,
        TEXT_TOKENS.xs,
        token.soft,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      {value}
    </span>
  );
}
