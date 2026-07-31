import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, TrendingUp, Wallet } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useFinanceReport } from "../hooks/use-reports";
import type { DateRange } from "../types";
import { MetricCard } from "./metric-card";
import { ChartCard } from "./chart-card";
import { ExportButtons } from "./export-buttons";

export function FinanceReportPanel({ companyId, range }: { companyId: string; range: DateRange }) {
  const { data, isLoading } = useFinanceReport(companyId, range);
  const m = data?.metrics;

  const rows =
    data?.byCategory.map((c) => ({
      Categoria: c.name,
      Receitas: formatCurrency(c.income),
      Despesas: formatCurrency(c.expense),
      Saldo: formatCurrency(c.income - c.expense),
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Financeiro</h2>
          <p className="text-sm text-muted-foreground">Fluxo de caixa, receitas, despesas e saldo.</p>
        </div>
        <ExportButtons filename="relatorio-financeiro" title="Relatório financeiro" rows={rows} disabled={!data} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Receitas" value={m ? formatCurrency(m.income) : undefined} icon={ArrowDownRight} tone="text-success" loading={isLoading} />
        <MetricCard label="Despesas" value={m ? formatCurrency(m.expense) : undefined} icon={ArrowUpRight} tone="text-destructive" loading={isLoading} />
        <MetricCard label="Saldo" value={m ? formatCurrency(m.balance) : undefined} icon={Wallet} loading={isLoading} />
        <MetricCard label="A receber / pagar" value={m ? `${formatCurrency(m.receivable)} / ${formatCurrency(m.payable)}` : undefined} icon={TrendingUp} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Fluxo de caixa" description="Saldo acumulado no período" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.daily ?? []}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" tickFormatter={(v) => formatNumber(v)} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend />
                <Line type="monotone" dataKey="income" name="Receitas" stroke="#16A34A" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="expense" name="Despesas" stroke="#DC2626" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="balance" name="Saldo acumulado" stroke="#2563EB" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Por categoria" description="Receitas x despesas">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(data?.byCategory ?? []).slice(0, 8)} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid horizontal={false} stroke="#E2E8F0" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94A3B8" tickFormatter={(v) => formatNumber(v)} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} stroke="#94A3B8" width={90} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="income" fill="#16A34A" radius={[0, 4, 4, 0]} />
                <Bar dataKey="expense" fill="#DC2626" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
