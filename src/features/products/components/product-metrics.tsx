import { Package, CheckCircle2, AlertTriangle, Wallet } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useProductMetrics } from "../hooks/use-products";
import { MetricCard, MetricGrid } from "@/components/design";
import type { StatusToken } from "@/design";

interface Props {
  companyId: string;
}

export function ProductMetrics({ companyId }: Props) {
  const { data, isLoading } = useProductMetrics(companyId);

  const items: {
    label: string;
    value: string;
    icon: typeof Package;
    status?: StatusToken;
  }[] = [
    {
      label: "Total de produtos",
      value: data ? formatNumber(data.total) : "—",
      icon: Package,
    },
    {
      label: "Produtos ativos",
      value: data ? formatNumber(data.active) : "—",
      icon: CheckCircle2,
      status: "success",
    },
    {
      label: "Estoque crítico",
      value: data ? formatNumber(data.critical) : "—",
      icon: AlertTriangle,
      status: "warning",
    },
    {
      label: "Valor em estoque",
      value: data ? formatCurrency(data.inventoryValue) : "—",
      icon: Wallet,
    },
  ];

  return (
    <MetricGrid columns={4}>
      {items.map((it) => (
        <MetricCard
          key={it.label}
          title={it.label}
          value={it.value}
          icon={it.icon}
          status={it.status}
          loading={isLoading}
        />
      ))}
    </MetricGrid>
  );
}
