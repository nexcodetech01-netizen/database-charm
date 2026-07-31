import { Sparkles, Lightbulb, Target, RefreshCw, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useExecutiveSummary } from "../intelligence/hooks";
import type { PeriodKey, ScoreBand } from "../intelligence/types";

interface Props {
  period?: PeriodKey;
}

const BAND_TONE: Record<ScoreBand, string> = {
  excelente: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  bom: "bg-primary/10 text-primary",
  atencao: "bg-warning/10 text-warning",
  critico: "bg-danger/10 text-danger",
};

/**
 * Resumo Executivo em cards horizontais enxutos.
 * Substitui o card extenso na Home; a análise completa continua
 * disponível nas abas Insights.
 */
export function BellaExecutiveStrip({ period = "month" }: Props) {
  const { data, isLoading, isFetching, refetch, error } = useExecutiveSummary(period);

  const score = data?.score;
  const topInsight = data?.insights?.[0]?.message;
  const topRecommendation = data?.recommendations?.[0];

  const placeholder = isLoading ? "Analisando…" : "Sem dados no período.";

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold tracking-tight">Resumo executivo</h2>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1.5 text-xs"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          Atualizar
        </Button>
      </header>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex items-center gap-3 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/50">
          <div
            className={cn(
              "grid h-11 w-11 shrink-0 place-items-center rounded-xl",
              BAND_TONE[score?.band ?? "bom"],
            )}
          >
            <Gauge className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Saúde do negócio
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums tracking-tight">
                {score ? score.score : "--"}
              </span>
              <span className="text-xs capitalize text-muted-foreground">
                {score?.band ?? (isLoading ? "calculando" : "sem dados")}
              </span>
            </div>
          </div>
        </div>

        <StripCard
          icon={<Lightbulb className="h-5 w-5" />}
          tone="bg-primary/10 text-primary"
          label="Insight principal"
          text={error ? "Falha ao gerar insights." : (topInsight ?? placeholder)}
        />

        <StripCard
          icon={<Target className="h-5 w-5" />}
          tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          label="Próxima ação"
          text={
            error
              ? "Falha ao gerar recomendações."
              : (topRecommendation?.suggestedAction ?? topRecommendation?.title ?? placeholder)
          }
        />
      </div>
    </section>
  );
}

function StripCard({
  icon,
  tone,
  label,
  text,
}: {
  icon: React.ReactNode;
  tone: string;
  label: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-border/50">
      <div className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-xl", tone)}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed text-foreground">{text}</p>
      </div>
    </div>
  );
}
