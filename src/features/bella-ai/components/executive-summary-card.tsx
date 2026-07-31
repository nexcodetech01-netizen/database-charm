import { Sparkles, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExecutiveSummary } from "../intelligence/hooks";
import { ExecutiveScoreGauge } from "./executive-score-gauge";
import { ExecutiveInsightsList } from "./executive-insights-list";
import { ExecutiveRecommendationsList } from "./executive-recommendations-list";
import type { PeriodKey } from "../intelligence/types";

interface Props {
  period?: PeriodKey;
}

/**
 * Resumo Executivo — Score + Insights + Recomendações consolidados.
 * Consome apenas dados reais do ERP através de `useExecutiveSummary`.
 */
export function ExecutiveSummaryCard({ period = "month" }: Props) {
  const { data, isLoading, isFetching, refetch, error } = useExecutiveSummary(period);

  return (
    <Card className="border-border/70">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-md bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight">
              Resumo Executivo
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Análise da Bella baseada em dados reais do seu ERP.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {data?.cache?.hit && (
            <Badge variant="secondary" className="h-5 text-[10px]">
              cache
            </Badge>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="grid gap-4 pt-0 lg:grid-cols-[minmax(0,280px)_1fr_1fr]">
        <div>
          <ExecutiveScoreGauge score={data?.score} loading={isLoading} />
        </div>
        <div>
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Insights
          </h4>
          {error ? (
            <p className="text-xs text-danger">Falha ao gerar insights.</p>
          ) : (
            <ExecutiveInsightsList insights={data?.insights} loading={isLoading} />
          )}
        </div>
        <div>
          <h4 className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Recomendações
          </h4>
          {error ? (
            <p className="text-xs text-danger">Falha ao gerar recomendações.</p>
          ) : (
            <ExecutiveRecommendationsList
              recommendations={data?.recommendations}
              loading={isLoading}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
