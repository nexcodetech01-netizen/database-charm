import { Link } from "@tanstack/react-router";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useBellaAudit, type UseBellaAuditOptions } from "./use-bella-audit";
import { AUDIT_SEVERITY_LABELS } from "./selectors";
import type { AuditSeverity } from "./types";

export interface BellaAuditBlockProps {
  companyId: string;
  className?: string;
  /** Retrato já lido pelo dashboard (evita consulta duplicada). */
  preloaded?: UseBellaAuditOptions["preloaded"];
  loading?: boolean;
}

const SEVERITY_TONES: Record<AuditSeverity, string> = {
  critical: "border-destructive/40 bg-destructive/5 text-destructive",
  high: "border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400",
  medium: "border-border/60 bg-muted/30 text-muted-foreground",
  low: "border-border/60 bg-muted/20 text-muted-foreground",
};

/**
 * Bloco "Saúde Operacional" — leitura pura da auditoria da Bella.
 * Nenhum botão corrige dados: apenas navegação para os módulos oficiais.
 */
export function BellaAuditBlock({
  companyId,
  className,
  preloaded,
  loading,
}: BellaAuditBlockProps) {
  const { view, isLoading } = useBellaAudit(
    companyId,
    preloaded === undefined ? {} : { preloaded, loading },
  );

  return (
    <Card className={cn("rounded-2xl", className)} data-testid="bella-audit-block">
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap items-start gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold leading-tight">Saúde Operacional</p>
            <p className="text-xs text-muted-foreground">{view.headline}</p>
          </div>
          {view.snapshot ? (
            <Badge variant="outline" className="rounded-lg font-normal">
              {view.snapshot.health.label}
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
                  metric.emphasis && "border-destructive/40 bg-destructive/5",
                )}
                data-testid={`bella-audit-metric-${metric.id}`}
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
            {view.note ?? "Sem dados suficientes para auditar."}
          </p>
        )}

        {view.findings.length > 0 ? (
          <ul className="space-y-2" data-testid="bella-audit-findings">
            {view.findings.slice(0, 5).map((f) => (
              <li
                key={f.id}
                className={cn(
                  "flex gap-2 rounded-xl border p-3 text-xs",
                  SEVERITY_TONES[f.severity],
                )}
              >
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>
                  <span className="font-medium">
                    {AUDIT_SEVERITY_LABELS[f.severity]} · {f.title}
                  </span>{" "}
                  — {f.count} registro(s). {f.recommendation}
                </span>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {view.links.map((link) => (
            <Button key={link.id} asChild size="sm" variant="outline" className="rounded-xl">
              <Link to={link.href}>{link.label}</Link>
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
