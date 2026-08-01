import { TrendingUp, PiggyBank, Receipt, AlertTriangle, type LucideIcon } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { MetricCard, MetricGrid } from "@/components/design";
import type { StatusToken } from "@/design";
import { useExecutiveSummary } from "../intelligence/hooks";

interface KpiItem {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  status: StatusToken;
}

/**
 * Linha única de KPIs da Home da Bella (UI.2.2 — MetricGrid + MetricCard).
 * Apenas apresentação — os números vêm do Resumo Executivo (dados reais).
 */
export function BellaKpiRow() {
  const { data, isLoading } = useExecutiveSummary("month");
  const m = data?.metrics;

  const alerts = (m?.critical_stock_count ?? 0) + (m?.overdue_bills_count ?? 0);

  const items: KpiItem[] = [
    {
      key: "revenue",
      label: "Faturamento",
      value: formatCurrency(m?.revenue_month ?? 0),
      icon: TrendingUp,
      status: "info",
    },
    {
      key: "reserve",
      label: "Reserva",
      value: formatCurrency(m?.profit_month ?? 0),
      icon: PiggyBank,
      status: "success",
    },
    {
      key: "orders",
      label: "Serviços",
      value: String(m?.orders_month ?? 0),
      icon: Receipt,
      status: "neutral",
    },
    {
      key: "alerts",
      label: "Alertas",
      value: String(alerts),
      icon: AlertTriangle,
      status: alerts > 0 ? "danger" : "success",
    },
  ];

  return (
    <MetricGrid label="KPIs da Bella" columns={4}>
      {items.map(({ key, label, value, icon, status }) => (
        <MetricCard
          key={key}
          title={label}
          value={value}
          icon={icon}
          status={status}
          loading={isLoading}
        />
      ))}
    </MetricGrid>
  );
}
