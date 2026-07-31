import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CheckCircle2, Clock, Package, ShoppingCart } from "lucide-react";
import { formatCurrency, formatNumber } from "@/lib/format";
import { usePurchasesReport } from "../hooks/use-reports";
import type { DateRange } from "../types";
import { MetricCard } from "./metric-card";
import { ChartCard } from "./chart-card";
import { ExportButtons } from "./export-buttons";

const COLORS = ["#2563EB", "#16A34A", "#0EA5E9", "#6366F1", "#DC2626", "#F59E0B"];
const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  received: "Recebida",
  cancelled: "Cancelada",
};

export function PurchasesReportPanel({ companyId, range }: { companyId: string; range: DateRange }) {
  const { data, isLoading } = usePurchasesReport(companyId, range);
  const m = data?.metrics;

  const rows =
    data?.topSuppliers.map((s) => ({
      Fornecedor: s.name,
      Pedidos: s.count,
      Total: formatCurrency(s.total),
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Compras</h2>
          <p className="text-sm text-muted-foreground">Pedidos, fornecedores e status.</p>
        </div>
        <ExportButtons filename="relatorio-compras" title="Relatório de compras" rows={rows} disabled={!data} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total comprado" value={m ? formatCurrency(m.total) : undefined} icon={ShoppingCart} loading={isLoading} />
        <MetricCard label="Pedidos" value={m ? formatNumber(m.count) : undefined} icon={Package} loading={isLoading} />
        <MetricCard label="Recebidas" value={m ? formatNumber(m.received) : undefined} icon={CheckCircle2} tone="text-success" loading={isLoading} />
        <MetricCard label="Pendentes" value={m ? formatNumber(m.pending) : undefined} icon={Clock} tone="text-warning" loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard title="Compras por dia" description="Total no período" className="xl:col-span-2">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.daily ?? []}>
                <CartesianGrid vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94A3B8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" tickFormatter={(v) => formatNumber(v)} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" fill="#2563EB" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Status" description="Distribuição dos pedidos">
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(data?.byStatus ?? []).map((s) => ({ ...s, name: STATUS_LABEL[s.name] ?? s.name }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {(data?.byStatus ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Top fornecedores" description="Maior volume comprado no período">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 text-left">Fornecedor</th>
                <th className="py-2 pr-3 text-right">Pedidos</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(data?.topSuppliers ?? []).map((s) => (
                <tr key={s.id ?? s.name} className="border-b border-border/60">
                  <td className="py-2 pr-3">{s.name}</td>
                  <td className="py-2 pr-3 text-right">{formatNumber(s.count)}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(s.total)}</td>
                </tr>
              ))}
              {data && data.topSuppliers.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-muted-foreground">Sem dados no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
