import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Info,
  Lightbulb,
  OctagonAlert,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  categoryLabel,
  severityLabel,
  type AccountingInsight,
  type InsightSeverity,
} from "../insights";

/** Painel "Insights da Bella" — apresentação pura (nenhum cálculo aqui). */
export interface InsightsPanelProps {
  insights: AccountingInsight[];
  loading?: boolean;
  limit?: number;
  className?: string;
}

const ICONS: Record<InsightSeverity, typeof Info> = {
  critical: OctagonAlert,
  warning: AlertTriangle,
  success: CheckCircle2,
  info: Info,
};

const TONES: Record<InsightSeverity, string> = {
  critical: "bg-destructive/10 text-destructive",
  warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  info: "bg-primary/10 text-primary",
};

export function InsightsPanel({
  insights,
  loading = false,
  limit = 8,
  className,
}: InsightsPanelProps) {
  const list = insights.slice(0, limit);

  return (
    <Card className={cn("rounded-2xl", className)}>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Lightbulb className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">Insights da Bella</p>
            <p className="text-xs text-muted-foreground">
              Interpretação dos dados reais do período — apenas recomendações.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Histórico insuficiente para gerar insights neste período.
          </p>
        ) : (
          <ul className="space-y-2">
            {list.map((insight) => {
              const Icon = ICONS[insight.severity];
              return (
                <li
                  key={insight.id}
                  className="flex gap-3 rounded-xl border border-border/60 p-3"
                >
                  <span
                    className={cn(
                      "grid h-8 w-8 shrink-0 place-items-center rounded-xl",
                      TONES[insight.severity],
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold leading-tight">{insight.title}</p>
                      <Badge variant="outline" className="rounded-lg font-normal">
                        {categoryLabel(insight.category)}
                      </Badge>
                      <Badge variant="secondary" className="rounded-lg font-normal">
                        {severityLabel(insight.severity)} · {insight.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{insight.description}</p>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ArrowRight className="h-3 w-3 shrink-0" aria-hidden="true" />
                      <span className="font-medium text-foreground">{insight.action.label}:</span>
                      <span className="truncate">{insight.recommendation}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
