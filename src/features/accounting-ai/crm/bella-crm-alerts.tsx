import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { BellaCrmActions } from "./bella-crm-actions";
import type { BellaCrmAlert } from "./types";

export interface BellaCrmAlertsProps {
  alerts: readonly BellaCrmAlert[];
  loading?: boolean;
  className?: string;
}

const TONES: Record<string, string> = {
  critical: "border-destructive/40 bg-destructive/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  info: "border-border/60",
};

const SOURCE_LABEL: Record<string, string> = {
  crm: "Clientes",
  proactive: "Bella",
};

/** Alertas de relacionamento — estados já registrados + proativos da Bella. */
export function BellaCrmAlerts({ alerts, loading = false, className }: BellaCrmAlertsProps) {
  return (
    <div className={cn("space-y-2", className)} data-testid="bella-crm-alerts">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
        <p className="text-sm font-semibold">Alertas de clientes</p>
      </div>

      {loading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum alerta de clientes no momento.</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={cn("space-y-1.5 rounded-xl border p-3", TONES[alert.severity])}
              data-testid={`bella-crm-alert-${alert.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold leading-tight">{alert.title}</p>
                <Badge variant="outline" className="rounded-lg font-normal">
                  {SOURCE_LABEL[alert.source]}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{alert.message}</p>
              <p className="text-xs text-muted-foreground">{alert.recommendation}</p>
              <BellaCrmActions size="xs" links={[alert.link]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
