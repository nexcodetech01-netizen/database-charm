import { Sparkles, Lightbulb, Target, RefreshCw, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MetricCard, MetricGrid, SectionHeader } from "@/components/design";
import { TEXT_TOKENS, type StatusToken } from "@/design";
import { useExecutiveSummary } from "../intelligence/hooks";
import type { PeriodKey, ScoreBand } from "../intelligence/types";

interface Props {
  period?: PeriodKey;
}

const BAND_STATUS: Record<ScoreBand, StatusToken> = {
  excelente: "success",
  bom: "info",
  atencao: "warning",
  critico: "danger",
};

/**
 * Resumo Executivo em MetricCards (UI.2.2).
 * Substitui o card extenso na Home; a análise completa continua
 * disponível nas abas Insights. Apenas apresentação.
 */
export function BellaExecutiveStrip({ period = "month" }: Props) {
  const { data, isLoading, isFetching, refetch, error } = useExecutiveSummary(period);

  const score = data?.score;
  const topInsight = data?.insights?.[0]?.message;
  const topRecommendation = data?.recommendations?.[0];

  const placeholder = isLoading ? "Analisando…" : "Sem dados no período.";

  return (
    <section className="space-y-4">
      <SectionHeader
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" /> Resumo executivo
          </span>
        }
        actions={
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            Atualizar
          </Button>
        }
      />

      <MetricGrid label="Resumo executivo" columns={3}>
        <MetricCard
          title="Saúde do negócio"
          value={score ? String(score.score) : "--"}
          icon={Gauge}
          status={BAND_STATUS[score?.band ?? "bom"]}
          loading={isLoading}
          footer={
            <span className={cn("capitalize text-muted-foreground", TEXT_TOKENS.xs)}>
              {score?.band ?? (isLoading ? "calculando" : "sem dados")}
            </span>
          }
        />

        <MetricCard
          title="Insight principal"
          value={
            <span className={cn("line-clamp-3 font-normal leading-relaxed", TEXT_TOKENS.sm)}>
              {error ? "Falha ao gerar insights." : (topInsight ?? placeholder)}
            </span>
          }
          icon={Lightbulb}
          status="info"
          loading={isLoading}
        />

        <MetricCard
          title="Próxima ação"
          value={
            <span className={cn("line-clamp-3 font-normal leading-relaxed", TEXT_TOKENS.sm)}>
              {error
                ? "Falha ao gerar recomendações."
                : (topRecommendation?.suggestedAction ?? topRecommendation?.title ?? placeholder)}
            </span>
          }
          icon={Target}
          status="success"
          loading={isLoading}
        />
      </MetricGrid>
    </section>
  );
}
