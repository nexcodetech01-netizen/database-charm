import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { useSalesReport } from "../hooks/use-reports";
import type { DateRange } from "../types";
import { ChartCard } from "./chart-card";
import { ExportButtons } from "./export-buttons";

const COLORS = ["#2563EB", "#16A34A", "#0EA5E9", "#6366F1", "#0891B2", "#7C3AED"];

const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  pending: "Pendente",
  paid: "Paga",
  cancelled: "Cancelada",
};
const PM_LABEL: Record<string, string> = {
  pix: "PIX",
  cash: "Dinheiro",
  card: "Cartão",
  bella_pay: "Bella Pay",
};

export function SalesReportPanel({ companyId, range }: { companyId: string; range: DateRange }) {
  const { data } = useSalesReport(companyId, range);

  const rows =
    data?.topSales.map((s) => ({
      Número: s.number ?? "-",
      Data: formatDate(s.date),
      Cliente: s.customer ?? "-",
      Status: STATUS_LABEL[s.status] ?? s.status,
      Total: formatCurrency(s.total),
    })) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <ExportButtons filename="relatorio-vendas" title="Relatório de vendas" rows={rows} disabled={!data} />
      </div>

      <ChartCard title="Receita diária" description="Vendas pagas por dia">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data?.daily ?? []} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="#94A3B8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94A3B8" tickFormatter={(v) => formatNumber(v)} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} labelStyle={{ color: "#0F172A" }} />
              <Area type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} fill="url(#fillRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ChartCard title="Formas de pagamento" description="Distribuição por método">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(data?.byPaymentMethod ?? []).map((p) => ({ ...p, name: PM_LABEL[p.name] ?? p.name }))}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={2}
                >
                  {(data?.byPaymentMethod ?? []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Indicadores de venda" description="Resumo do período">
          <div className="grid h-64 grid-cols-2 gap-3">
            <div className="flex flex-col justify-center rounded-lg border border-border/60 bg-muted/30 p-4">
              <span className="text-xs text-muted-foreground">Ticket médio</span>
              <span className="mt-1 text-xl font-semibold tracking-tight">
                {data ? formatCurrency(data.metrics.avgTicket) : "—"}
              </span>
            </div>
            <div className="flex flex-col justify-center rounded-lg border border-border/60 bg-muted/30 p-4">
              <span className="text-xs text-muted-foreground">Pedidos</span>
              <span className="mt-1 text-xl font-semibold tracking-tight">
                {data ? formatNumber(data.metrics.count) : "—"}
              </span>
            </div>
            <div className="flex flex-col justify-center rounded-lg border border-border/60 bg-muted/30 p-4">
              <span className="text-xs text-muted-foreground">Receita hoje</span>
              <span className="mt-1 text-xl font-semibold tracking-tight">
                {data ? formatCurrency(data.metrics.revenueToday) : "—"}
              </span>
            </div>
            <div className="flex flex-col justify-center rounded-lg border border-border/60 bg-muted/30 p-4">
              <span className="text-xs text-muted-foreground">
                Receita bruta do mês
              </span>
              <span className="mt-1 text-xl font-semibold tracking-tight">
                {data ? formatCurrency(data.metrics.revenueMonth) : "—"}
              </span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">
                Líquido:{" "}
                {data ? formatCurrency(data.metrics.netRevenueMonth) : "—"}
              </span>
            </div>
          </div>
        </ChartCard>
      </div>

      <ChartCard
        title="Top vendas do período"
        description="10 maiores vendas pagas"
        action={
          <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">
            Ver relatório completo
          </Button>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3 text-left">Número</th>
                <th className="py-2 pr-3 text-left">Data</th>
                <th className="py-2 pr-3 text-left">Cliente</th>
                <th className="py-2 pr-3 text-left">Status</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {(data?.topSales ?? []).map((s) => (
                <tr key={s.id} className="border-b border-border/60">
                  <td className="py-2 pr-3 font-medium">{s.number ?? "-"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{formatDate(s.date)}</td>
                  <td className="py-2 pr-3">{s.customer ?? "-"}</td>
                  <td className="py-2 pr-3 text-muted-foreground">{STATUS_LABEL[s.status] ?? s.status}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(s.total)}</td>
                </tr>
              ))}
              {data && data.topSales.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">Nenhuma venda no período.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}
