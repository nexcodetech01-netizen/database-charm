import { CircleDollarSign, Sparkles, Target, TrendingUp } from "lucide-react";
import { KpiCard, KpiSection } from "@/components/layout";
import { formatCurrency } from "@/lib/format";

interface Props {
  metrics?: {
    total: number;
    open: number;
    won: number;
    lost: number;
    pipelineValue: number;
    weighted: number;
    wonValue: number;
    conversion: number;
  };
  isLoading?: boolean;
}

/**
 * KPIs do CRM — visão executiva do funil.
 * Layout padrão NexOS: KpiSection + KpiCard.
 */
export function CrmMetrics({ metrics, isLoading }: Props) {
  return (
    <KpiSection columns={4}>
      <KpiCard
        label="Leads"
        icon={Sparkles}
        loading={isLoading}
        value={metrics ? metrics.open : "—"}
        hint={metrics ? `${metrics.total} oportunidades no total` : undefined}
      />
      <KpiCard
        label="Oportunidades"
        icon={Target}
        loading={isLoading}
        value={metrics ? metrics.total : "—"}
        hint={
          metrics
            ? `${metrics.won} ganhas · ${metrics.lost} perdidas`
            : undefined
        }
      />
      <KpiCard
        label="Valor do pipeline"
        icon={CircleDollarSign}
        loading={isLoading}
        value={metrics ? formatCurrency(metrics.pipelineValue) : "—"}
        hint={
          metrics ? `Ponderado ${formatCurrency(metrics.weighted)}` : undefined
        }
      />
      <KpiCard
        label="Conversão"
        icon={TrendingUp}
        loading={isLoading}
        value={metrics ? `${metrics.conversion.toFixed(1)}%` : "—"}
        hint={
          metrics
            ? `${formatCurrency(metrics.wonValue)} fechados`
            : undefined
        }
        trend={
          metrics
            ? {
                value: `${metrics.won}/${Math.max(1, metrics.won + metrics.lost)}`,
                direction: metrics.conversion >= 50 ? "up" : "flat",
                intent: metrics.conversion >= 50 ? "positive" : "neutral",
              }
            : undefined
        }
      />
    </KpiSection>
  );
}
