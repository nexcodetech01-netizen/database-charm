import { Link } from "@tanstack/react-router";
import { Calculator, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useBellaTax, type UseBellaTaxOptions } from "./use-bella-tax";

export interface BellaTaxBlockProps {
  companyId: string;
  className?: string;
  /** Retrato já lido pelo dashboard (evita consulta duplicada). */
  preloaded?: UseBellaTaxOptions["preloaded"];
  loading?: boolean;
}

const ALERT_TONES: Record<string, string> = {
  critical: "border-destructive/40 bg-destructive/5 text-destructive",
  warning: "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  info: "border-border/60 bg-muted/30 text-muted-foreground",
};

/**
 * Bloco tributário da Bella — leitura do motor oficial do Simples.
 * Nenhum botão executa apuração ou pagamento: apenas navegação.
 */
export function BellaTaxBlock({
  companyId,
  className,
  preloaded,
  loading,
}: BellaTaxBlockProps) {
  const { view, isLoading } = useBellaTax(
    companyId,
    preloaded === undefined ? {} : { preloaded, loading },
  );

  return (
    <Card className={cn("rounded-2xl", className)} data-testid="bella-tax-block">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Calculator className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Bella Tributária</p>
            <p className="text-xs text-muted-foreground">{view.headline}</p>
          </div>
          {view.snapshot?.dasSource === "simulacao" ? (
            <Badge variant="outline" className="rounded-lg font-normal">
              Previsto
            </Badge>
          ) : null}
        </div>

        {isLoading ? (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : view.available ? (
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {view.metrics.map((metric) => (
              <li
                key={metric.id}
                className={cn(
                  "rounded-xl border border-border/60 p-3",
                  metric.emphasis && "border-primary/40 bg-primary/5",
                )}
                data-testid={`bella-tax-metric-${metric.id}`}
              >
                <p className="text-xs text-muted-foreground">{metric.label}</p>
                <p className="text-base font-semibold tabular-nums">{metric.value}</p>
                {metric.hint ? (
                  <p className="truncate text-[11px] text-muted-foreground">{metric.hint}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-xl border border-dashed border-border/60 p-3 text-xs text-muted-foreground">
            {view.note ?? "Sem dados tributários para o período."}
          </p>
        )}

        {view.alerts.length > 0 ? (
          <ul className="space-y-2" data-testid="bella-tax-alerts">
            {view.alerts.map((alert) => (
              <li
                key={alert.id}
                className={cn(
                  "flex gap-2 rounded-xl border p-3 text-xs",
                  ALERT_TONES[alert.level] ?? ALERT_TONES.info,
                )}
              >
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-medium">{alert.title}</span> — {alert.description}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {view.links.map((link) => (
            <Button
              key={link.id}
              asChild
              size="sm"
              variant="outline"
              className="rounded-xl"
            >
              <Link to={link.href}>{link.label}</Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
