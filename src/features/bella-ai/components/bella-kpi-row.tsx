import { TrendingUp, PiggyBank, Receipt, AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";
import { useExecutiveSummary } from "../intelligence/hooks";

interface KpiItem {
  key: string;
  label: string;
  value: string;
  icon: LucideIcon;
  tone: string;
}

/**
 * Linha única de KPIs da Home da Bella.
 * Apenas apresentação — os números vêm do Resumo Executivo (dados reais).
 */
export function BellaKpiRow() {
  const { data, isLoading } = useExecutiveSummary("month");
  const m = data?.metrics;

  const alerts =
    (m?.critical_stock_count ?? 0) + (m?.overdue_bills_count ?? 0);

  const items: KpiItem[] = [
    {
      key: "revenue",
      label: "Faturamento",
      value: formatCurrency(m?.revenue_month ?? 0),
      icon: TrendingUp,
      tone: "bg-primary/10 text-primary",
    },
    {
      key: "reserve",
      label: "Reserva",
      value: formatCurrency(m?.profit_month ?? 0),
      icon: PiggyBank,
      tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "orders",
      label: "Serviços",
      value: String(m?.orders_month ?? 0),
      icon: Receipt,
      tone: "bg-primary/10 text-primary",
    },
    {
      key: "alerts",
      label: "Alertas",
      value: String(alerts),
      icon: AlertTriangle,
      tone: "bg-danger/10 text-danger",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map(({ key, label, value, icon: Icon, tone }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-2xl bg-card p-4 shadow-sm ring-1 ring-border/50"
        >
          <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", tone)}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
            <div
              className={cn(
                "truncate text-lg font-semibold tabular-nums tracking-tight",
                isLoading && "animate-pulse text-muted-foreground",
              )}
            >
              {value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
