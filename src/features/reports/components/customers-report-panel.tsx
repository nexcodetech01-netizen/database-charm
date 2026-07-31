import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { UserCheck, UserPlus, UserX, Users } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useCustomersReport } from "../hooks/use-reports";
import type { DateRange } from "../types";
import { MetricCard } from "./metric-card";
import { ChartCard } from "./chart-card";
import { ExportButtons } from "./export-buttons";

export function CustomersReportPanel({ companyId, range }: { companyId: string; range: DateRange }) {
  const { data, isLoading } = useCustomersReport(companyId, range);
  const m = data?.metrics;

  const rows =
    data?.topCustomers.map((c) => ({
      Cliente: c.name,
      Compras: c.purchases,
      Receita: formatCurrency(c.revenue),
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Clientes</h2>
          <p className="text-sm text-muted-foreground">Novos, recorrentes e inativos.</p>
        </div>
        <ExportButtons filename="relatorio-clientes" title="Relatório de clientes" rows={rows} disabled={!data} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total" value={m ? formatNumber(m.total) : undefined} icon={Users} loading={isLoading} />
        <MetricCard label="Novos no período" value={m ? formatNumber(m.newInRange) : undefined} icon={UserPlus} tone="text-success" loading={isLoading} />
        <MetricCard label="Recorrentes" value={m ? formatNumber(m.recurring) : undefined} icon={UserCheck} loading={isLoading} />
        <MetricCard label="Inativos (90d)" value={m ? formatNumber(m.inactive) : undefined} icon={UserX} tone="text-destructive" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Novos clientes por dia" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.daily ?? []}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Top clientes" description="Maior receita no período">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 text-left">Cliente</th>
                  <th className="py-2 text-right">Receita</th>
                </tr>
              </thead>
              <tbody>
                {(data?.topCustomers ?? []).map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className="py-2 pr-3">
                      <div>{c.name}</div>
                      <div className="text-xs text-muted-foreground">{formatNumber(c.purchases)} compra(s)</div>
                    </td>
                    <td className="py-2 text-right font-medium">{formatCurrency(c.revenue)}</td>
                  </tr>
                ))}
                {data && data.topCustomers.length === 0 && (
                  <tr><td colSpan={2} className="py-6 text-center text-muted-foreground">Sem dados no período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </ChartCard>
      </div>
    </div>
  );
}
