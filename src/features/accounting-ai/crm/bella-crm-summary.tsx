import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatCrmMetric } from "./selectors";
import type { BellaCrmDetail, BellaCrmHealth, BellaCrmMetric } from "./types";

export interface BellaCrmSummaryProps {
  metrics: readonly BellaCrmMetric[];
  details: readonly BellaCrmDetail[];
  health: BellaCrmHealth | null;
  loading?: boolean;
  className?: string;
}

const HEALTH_TONES: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive",
  attention: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  healthy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  unknown: "bg-muted text-muted-foreground",
};

/** Resumo de relacionamento da Bella — leitura das métricas já apuradas. */
export function BellaCrmSummary({
  metrics,
  details,
  health,
  loading = false,
  className,
}: BellaCrmSummaryProps) {
  return (
    <div className={cn("space-y-3", className)} data-testid="bella-crm-summary">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold">Resumo dos clientes</p>
        {health ? (
          <Badge
            variant="outline"
            className={cn("ml-auto rounded-lg font-normal", HEALTH_TONES[health.level])}
          >
            {health.label} · {health.score}/100
          </Badge>
        ) : null}
      </div>

      {loading ? (
        <div className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
          <Skeleton className="h-14 rounded-xl" />
        </div>
      ) : (
        <>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric) => (
              <li
                key={metric.id}
                className="rounded-xl border border-border/60 p-3"
                data-testid={`bella-crm-metric-${metric.id}`}
              >
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="text-base font-semibold tabular-nums">
                  {formatCrmMetric(metric)}
                </p>
                {metric.hint ? (
                  <p className="truncate text-[11px] text-muted-foreground">{metric.hint}</p>
                ) : null}
              </li>
            ))}
          </ul>

          <ul className="space-y-1.5 rounded-xl border border-border/60 p-3">
            {details.map((detail) => (
              <li
                key={detail.id}
                className="flex items-center justify-between gap-3 text-sm"
                data-testid={`bella-crm-detail-${detail.id}`}
              >
                <a
                  href={detail.link.href}
                  className="truncate text-muted-foreground underline-offset-2 hover:underline"
                >
                  {detail.label}
                </a>
                <span className="shrink-0 truncate font-medium tabular-nums">
                  {detail.available && detail.value ? detail.value : "—"}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
