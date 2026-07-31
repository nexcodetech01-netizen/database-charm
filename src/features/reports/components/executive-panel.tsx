import {
  Banknote,
  TrendingUp,
  Receipt,
  Package,
  Users,
  Boxes,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useExecutiveMetrics } from "../hooks/use-reports";
import type { DateRange } from "../types";
import { MetricCard } from "./metric-card";
import { ExportButtons } from "./export-buttons";

export function ExecutivePanel({ companyId, range }: { companyId: string; range: DateRange }) {
  const { data, isLoading } = useExecutiveMetrics(companyId, range);

  const cards = [
    { label: "Receita total", value: data ? formatCurrency(data.totalRevenue) : undefined, icon: Banknote, tone: "text-success" },
    { label: "Lucro bruto", value: data ? formatCurrency(data.grossProfit) : undefined, icon: TrendingUp, tone: "text-primary" },
    { label: "Total de vendas", value: data ? formatNumber(data.totalSales) : undefined, icon: Receipt, tone: "text-primary" },
    { label: "Produtos vendidos", value: data ? formatNumber(data.productsSold) : undefined, icon: Package, tone: "text-primary" },
    { label: "Clientes ativos", value: data ? formatNumber(data.activeCustomers) : undefined, icon: Users, tone: "text-primary" },
    { label: "Valor do estoque", value: data ? formatCurrency(data.inventoryValue) : undefined, icon: Boxes, tone: "text-primary" },
    { label: "Contas a receber", value: data ? formatCurrency(data.receivable) : undefined, icon: ArrowDownRight, tone: "text-success" },
    { label: "Contas a pagar", value: data ? formatCurrency(data.payable) : undefined, icon: ArrowUpRight, tone: "text-destructive" },
  ];

  const rows = data
    ? [
        { Indicador: "Receita total", Valor: formatCurrency(data.totalRevenue) },
        { Indicador: "Lucro bruto", Valor: formatCurrency(data.grossProfit) },
        { Indicador: "Total de vendas", Valor: data.totalSales },
        { Indicador: "Produtos vendidos", Valor: data.productsSold },
        { Indicador: "Clientes ativos", Valor: data.activeCustomers },
        { Indicador: "Valor do estoque", Valor: formatCurrency(data.inventoryValue) },
        { Indicador: "Contas a receber", Valor: formatCurrency(data.receivable) },
        { Indicador: "Contas a pagar", Valor: formatCurrency(data.payable) },
      ]
    : [];

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Dashboard executivo</h2>
          <p className="text-sm text-muted-foreground">Visão consolidada dos principais indicadores.</p>
        </div>
        <ExportButtons filename="dashboard-executivo" title="Dashboard executivo" rows={rows} disabled={!data} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((c) => (
          <MetricCard key={c.label} {...c} loading={isLoading} />
        ))}
      </div>
    </section>
  );
}
