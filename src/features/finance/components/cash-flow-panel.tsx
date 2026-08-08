import { formatCurrency } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { CashSessionCard } from "@/features/cash";
import { useFinanceOverview } from "../hooks/use-finance";
import { DailyCashFlowChart } from "./finance-charts";

export function CashFlowPanel({ companyId }: { companyId: string }) {
  const { data, isLoading } = useFinanceOverview(companyId);

  const monthResult = (data?.monthIncome ?? 0) - (data?.monthExpense ?? 0);

  return (
    <div className="space-y-4">
      <CashSessionCard companyId={companyId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Saldo atual"
          value={formatCurrency(data?.currentBalance ?? 0)}
          loading={isLoading}
          tone="text-primary"
        />
        <Stat
          label="Recebimento de Vendas"
          value={formatCurrency(data?.monthIncome ?? 0)}
          loading={isLoading}
          tone="text-success"
        />
        <Stat
          label="Compra de Mercadoria / Estoque"
          value={formatCurrency(data?.monthExpense ?? 0)}
          loading={isLoading}
          tone="text-destructive"
        />
        <Stat
          label="Resultado do mês"
          value={formatCurrency(monthResult)}
          loading={isLoading}
          tone={monthResult >= 0 ? "text-success" : "text-destructive"}
        />
      </div>

      <DailyCashFlowChart companyId={companyId} />

      <div className="rounded-xl border border-border bg-card p-6">
        <div className="mb-2">
          <h3 className="text-sm font-semibold">Saldo previsto</h3>
          <p className="text-xs text-muted-foreground">
            Saldo atual + contas a receber − contas a pagar.
          </p>
        </div>
        {isLoading ? (
          <Skeleton className="h-8 w-40" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums text-primary">
            {formatCurrency(data?.projected ?? 0)}
          </p>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  loading,
  tone,
}: {
  label: string;
  value: string;
  loading: boolean;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <p className="text-sm text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-28" />
      ) : (
        <p className={`mt-2 text-xl font-semibold tabular-nums ${tone}`}>{value}</p>
      )}
    </div>
  );
}
