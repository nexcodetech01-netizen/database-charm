import {
  Wallet,
  ArrowDownRight,
  ArrowUpRight,
  TrendingUp,
  ArrowDownCircle,
  ArrowUpCircle,
  Scale,
  LineChart,
} from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useFinanceOverview } from "../hooks/use-finance";

interface MetricItem {
  label: string;
  value?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: string;
  accent: string;
}

export function FinanceMetrics({ companyId }: { companyId: string }) {
  const { data, isLoading } = useFinanceOverview(companyId);

  const monthResult = data ? data.monthIncome - data.monthExpense : undefined;
  const cashFlow = data ? data.receivable - data.payable : undefined;

  const items: MetricItem[] = [
    {
      label: "Saldo atual",
      value: data ? formatCurrency(data.currentBalance) : undefined,
      icon: Wallet,
      tone: "text-primary",
      accent: "bg-primary/10",
    },
    {
      label: "Receitas do mês",
      value: data ? formatCurrency(data.monthIncome) : undefined,
      icon: ArrowDownCircle,
      tone: "text-success",
      accent: "bg-success/10",
    },
    {
      label: "Despesas do mês",
      value: data ? formatCurrency(data.monthExpense) : undefined,
      icon: ArrowUpCircle,
      tone: "text-destructive",
      accent: "bg-destructive/10",
    },
    {
      label: "Resultado do mês",
      value: monthResult !== undefined ? formatCurrency(monthResult) : undefined,
      icon: Scale,
      tone:
        monthResult !== undefined && monthResult < 0 ? "text-destructive" : "text-success",
      accent:
        monthResult !== undefined && monthResult < 0 ? "bg-destructive/10" : "bg-success/10",
    },
    {
      label: "Contas a receber",
      value: data ? formatCurrency(data.receivable) : undefined,
      icon: ArrowDownRight,
      tone: "text-success",
      accent: "bg-success/10",
    },
    {
      label: "Contas a pagar",
      value: data ? formatCurrency(data.payable) : undefined,
      icon: ArrowUpRight,
      tone: "text-destructive",
      accent: "bg-destructive/10",
    },
    {
      label: "Fluxo de caixa",
      value: cashFlow !== undefined ? formatCurrency(cashFlow) : undefined,
      icon: LineChart,
      tone: cashFlow !== undefined && cashFlow < 0 ? "text-destructive" : "text-primary",
      accent: cashFlow !== undefined && cashFlow < 0 ? "bg-destructive/10" : "bg-primary/10",
    },
    {
      label: "Saldo previsto",
      value: data ? formatCurrency(data.projected) : undefined,
      icon: TrendingUp,
      tone: "text-primary",
      accent: "bg-primary/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <MetricCard key={it.label} item={it} isLoading={isLoading} />
      ))}
    </div>
  );
}

function MetricCard({ item, isLoading }: { item: MetricItem; isLoading: boolean }) {
  const Icon = item.icon;
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{item.label}</span>
        <div className={`grid h-8 w-8 place-items-center rounded-md ${item.accent}`}>
          <Icon className={`h-4 w-4 ${item.tone}`} />
        </div>
      </div>
      <div className="mt-3">
        {isLoading ? (
          <Skeleton className="h-8 w-32" />
        ) : (
          <span className="text-2xl font-semibold tracking-tight tabular-nums">
            {item.value ?? "—"}
          </span>
        )}
      </div>
    </div>
  );
}
