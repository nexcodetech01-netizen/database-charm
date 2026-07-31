import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { categoryLabel, type BellaNotification } from "../proactive";
import { BellaFinanceActions } from "./bella-finance-actions";
import { financeLinkForAction } from "./links";

export interface BellaFinanceAlertsProps {
  alerts: readonly BellaNotification[];
  loading?: boolean;
  className?: string;
}

const TONES: Record<string, string> = {
  critical: "border-destructive/40 bg-destructive/5",
  warning: "border-amber-500/40 bg-amber-500/5",
  success: "border-emerald-500/40 bg-emerald-500/5",
  info: "border-border/60",
};

/** Alertas financeiros — apenas notificações proativas já existentes. */
export function BellaFinanceAlerts({ alerts, loading = false, className }: BellaFinanceAlertsProps) {
  return (
    <div className={cn("space-y-2", className)} data-testid="bella-finance-alerts">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />
        <p className="text-sm font-semibold">Alertas financeiros</p>
      </div>

      {loading ? (
        <Skeleton className="h-16 w-full rounded-xl" />
      ) : alerts.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum alerta financeiro no momento.</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={cn("space-y-1.5 rounded-xl border p-3", TONES[alert.severity])}
              data-testid={`bella-finance-alert-${alert.id}`}
            >
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold leading-tight">{alert.title}</p>
                <Badge variant="outline" className="rounded-lg font-normal">
                  {categoryLabel(alert.category)}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{alert.message}</p>
              <BellaFinanceActions size="xs" links={[financeLinkForAction(alert.action.id)]} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
