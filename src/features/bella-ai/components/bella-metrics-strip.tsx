import { Card, CardContent } from "@/components/ui/card";
import { Activity, AlertOctagon, Flame, Gauge, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BellaMetricsSnapshot } from "../dashboard";

interface BellaMetricsStripProps {
  metrics: BellaMetricsSnapshot;
}

interface Item {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
  tone: string;
}

/**
 * KPIs derivados dos eventos ativos (sem recalcular regras de negócio).
 */
export function BellaMetricsStrip({ metrics }: BellaMetricsStripProps) {
  const items: Item[] = [
    { key: "critical", label: "Críticos", value: metrics.critical, icon: Flame, tone: "bg-danger/10 text-danger" },
    { key: "high", label: "Altos", value: metrics.high, icon: AlertOctagon, tone: "bg-warning/10 text-warning" },
    { key: "medium", label: "Médios", value: metrics.medium, icon: Activity, tone: "bg-primary/10 text-primary" },
    { key: "total", label: "Ativos", value: metrics.totalActive, icon: Gauge, tone: "bg-muted text-muted-foreground" },
  ];

  return (
    <Card className="border-border/70">
      <CardContent className="grid grid-cols-2 gap-2 p-3 md:grid-cols-4">
        {items.map(({ key, label, value, icon: Icon, tone }) => (
          <div
            key={key}
            className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-card px-3 py-2"
          >
            <div className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md", tone)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
              </div>
              <div className="truncate text-sm font-semibold tracking-tight">{value}</div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
