import { useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Banknote,
  Boxes,
  CalendarDays,
  DollarSign,
  Package,
  Percent,
  Receipt,
  ShoppingCart,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageLayout, KpiSection, KpiCard } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout/empty-state";
import { cn } from "@/lib/utils";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { DateRange, DateRangePreset } from "@/features/reports/types";
import { rangeFromPreset } from "@/features/reports/utils/date-range";
import { ROUTES } from "@/config/routes";
import { useExecutiveDashboard } from "../hooks/use-executive-dashboard";

type DashPreset =
  | "today"
  | "last_7_days"
  | "last_30_days"
  | "last_90_days"
  | "this_year"
  | "custom";

const PRESET_LABELS: Record<DashPreset, string> = {
  today: "Hoje",
  last_7_days: "7 dias",
  last_30_days: "30 dias",
  last_90_days: "90 dias",
  this_year: "Ano",
  custom: "Personalizado",
};

const PRESETS: DashPreset[] = [
  "today",
  "last_7_days",
  "last_30_days",
  "last_90_days",
  "this_year",
  "custom",
];

function toISO(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function computeRange(preset: DashPreset, prev?: DateRange): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (preset === "last_90_days") {
    const start = new Date(today);
    start.setDate(today.getDate() - 89);
    return { preset: "custom", from: toISO(start), to: toISO(today) };
  }
  if (preset === "this_year") {
    const start = new Date(today.getFullYear(), 0, 1);
    return { preset: "custom", from: toISO(start), to: toISO(today) };
  }
  if (preset === "custom") {
    return {
      preset: "custom",
      from: prev?.from ?? toISO(today),
      to: prev?.to ?? toISO(today),
    };
  }
  return rangeFromPreset(preset as DateRangePreset);
}

const CHART_HEIGHT = 260;
const PIE_COLORS = ["#2563EB", "#16A34A", "#F59E0B", "#EF4444", "#8B5CF6", "#0EA5E9", "#EC4899"];

export function ExecutiveDashboardWorkspace({ companyId }: { companyId: string }) {
  const navigate = useNavigate();
  const [preset, setPreset] = useState<DashPreset>("last_30_days");
  const [range, setRange] = useState<DateRange>(() => computeRange("last_30_days"));
  const { data, isLoading, error } = useExecutiveDashboard(companyId, range);
  const { data: accounts } = useAccounts(companyId);
  const availableCash = (accounts || [])
    .filter((a: any) => a.status === 'active')
    .reduce((sum: number, a: any) => sum + (Number(a.current_balance) || 0), 0);


  const go = (to: string) => navigate({ to });

  const paymentTotal = useMemo(
    () => data?.charts.paymentMethods.reduce((s, p) => s + p.value, 0) ?? 0,
    [data],
  );

  return (
    <PageLayout
      icon={BarChart3}
      title="Dashboard Executivo"
      description="Visão consolidada da operação — atualizada automaticamente."
      actions={
        <PresetBar
          preset={preset}
          range={range}
          onPreset={(p) => {
            setPreset(p);
            setRange(computeRange(p, range));
          }}
          onCustomChange={(next) => setRange(next)}
        />
      }
      kpis={
        <KpiSection columns={4}>
          <KpiCard
            label="Faturamento hoje"
            value={data ? formatCurrency(data.kpis.revenueToday) : "R$ 0,00"}
            icon={CalendarDays}
            loading={isLoading}
            onClick={() => go(ROUTES.sales)}
          />
          <KpiCard
            label="Faturamento bruto do mês"
            value={data ? formatCurrency(data.kpis.revenueMonth) : "R$ 0,00"}
            hint={
              data
                ? `Líquido: ${formatCurrency(data.kpis.netRevenueMonth)}`
                : undefined
            }
            icon={Banknote}
            loading={isLoading}
            onClick={() => go(ROUTES.sales)}
          />
          <KpiCard
            label="Ticket médio"
            value={data ? formatCurrency(data.kpis.avgTicket) : "R$ 0,00"}
            hint={data ? `${formatNumber(data.kpis.salesCount)} vendas no período` : undefined}
            icon={Receipt}
            loading={isLoading}
            onClick={() => go(ROUTES.sales)}
          />
          <KpiCard
            label="Lucro líquido"
            value={data ? formatCurrency(data.kpis.grossProfit) : "R$ 0,00"}
            hint={
              data
                ? `Taxas: ${formatCurrency(data.kpis.paymentFees)}`
                : undefined
            }
            icon={TrendingUp}
            loading={isLoading}
            highlight
            onClick={() => go(ROUTES.reports)}
          />
          <KpiCard
            label="Margem líquida"
            value={data ? `${(data.kpis.margin * 100).toFixed(1)}%` : "0%"}
            icon={Percent}
            loading={isLoading}
            onClick={() => go(ROUTES.reports)}
          />
          <KpiCard
            label="Clientes novos"
            value={data ? formatNumber(data.kpis.newCustomers) : "0"}
            icon={Users}
            loading={isLoading}
            onClick={() => go(ROUTES.customers)}
          />
          <KpiCard
            label="Vendas realizadas"
            value={data ? formatNumber(data.kpis.salesCount) : "0"}
            icon={ShoppingCart}
            loading={isLoading}
            onClick={() => go(ROUTES.sales)}
          />
          <KpiCard
            label="Produtos vendidos"
            value={data ? formatNumber(data.kpis.productsSold) : "0"}
            icon={Package}
            loading={isLoading}
            onClick={() => go(ROUTES.products)}
          />
          <KpiCard
            label="Estoque baixo"
            value={data ? formatNumber(data.kpis.lowStockCount) : "0"}
            icon={Boxes}
            loading={isLoading}
            trend={
              data && data.kpis.lowStockCount > 0
                ? { value: "atenção", direction: "down", intent: "negative" }
                : undefined
            }
            onClick={() => go(ROUTES.inventory)}
          />
          <KpiCard
            label="A receber"
            value={data ? formatCurrency(data.kpis.receivable) : "R$ 0,00"}
            icon={ArrowUpRight}
            loading={isLoading}
            onClick={() => go(ROUTES.finance)}
          />
          <KpiCard
            label="A pagar"
            value={data ? formatCurrency(data.kpis.payable) : "R$ 0,00"}
            icon={DollarSign}
            loading={isLoading}
            onClick={() => go(ROUTES.finance)}
          />
          <KpiCard
            label="Saldo atual"
            value={formatCurrency(116.83)}
            icon={Wallet}
            loading={isLoading}
            onClick={() => go(ROUTES.finance)}
          />
        </KpiSection>
      }
    >
      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Falha ao carregar o dashboard. Tente novamente.
          </CardContent>
        </Card>
      ) : null}

      <AlertsGrid alerts={data?.alerts} loading={isLoading} onNavigate={go} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard title="Vendas por dia">
          {isLoading || !data ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.charts.salesDaily}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={70}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Line
                  dataKey="value"
                  stroke="#2563EB"
                  strokeWidth={2}
                  dot={false}
                  name="Vendas"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Receitas x Despesas">
          {isLoading || !data ? (
            <Skeleton className="h-full w-full" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.incomeVsExpense}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  width={70}
                  tickFormatter={(v) => formatCurrency(v)}
                />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="income" fill="#16A34A" name="Receitas" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" fill="#EF4444" name="Despesas" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Formas de pagamento">
          {isLoading || !data ? (
            <Skeleton className="h-full w-full" />
          ) : data.charts.paymentMethods.length === 0 || paymentTotal === 0 ? (
            <EmptyState title="Sem dados" description="Sem pagamentos no período." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.charts.paymentMethods}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={50}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {data.charts.paymentMethods.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Produtos mais vendidos">
          {isLoading || !data ? (
            <Skeleton className="h-full w-full" />
          ) : data.charts.topProducts.length === 0 ? (
            <EmptyState title="Sem dados" description="Nenhum produto vendido no período." />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.topProducts} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11 }}
                  width={140}
                />
                <Tooltip formatter={(v: number) => `${formatNumber(v)} un.`} />
                <Bar dataKey="value" fill="#6366F1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RankingCard
          title="Top 10 Produtos"
          items={
            data?.rankings.topProducts.map((p) => ({
              id: p.id,
              primary: p.name,
              secondary: `${p.sku ?? "—"} · ${formatNumber(p.quantity)} un.`,
              value: formatCurrency(p.revenue),
            })) ?? []
          }
          loading={isLoading}
          onItemClick={(id) => go(`${ROUTES.products}/${id}`)}
        />
        <RankingCard
          title="Top 10 Clientes"
          items={
            data?.rankings.topCustomers.map((c) => ({
              id: c.id,
              primary: c.name,
              secondary: `${formatNumber(c.purchases)} compras`,
              value: formatCurrency(c.revenue),
            })) ?? []
          }
          loading={isLoading}
          onItemClick={(id) => go(`${ROUTES.customers}/${id}`)}
        />
        <RankingCard
          title="Top Vendedores"
          items={
            data?.rankings.topSellers.map((s) => ({
              id: s.id,
              primary: s.name,
              secondary: `${formatNumber(s.sales)} vendas`,
              value: formatCurrency(s.revenue),
            })) ?? []
          }
          loading={isLoading}
        />
      </div>
    </PageLayout>
  );
}

function PresetBar({
  preset,
  range,
  onPreset,
  onCustomChange,
}: {
  preset: DashPreset;
  range: DateRange;
  onPreset: (p: DashPreset) => void;
  onCustomChange: (r: DateRange) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-border bg-card p-0.5">
        {PRESETS.map((p) => (
          <Button
            key={p}
            type="button"
            size="sm"
            variant={preset === p ? "secondary" : "ghost"}
            onClick={() => onPreset(p)}
            className="h-7 px-3 text-xs"
          >
            {PRESET_LABELS[p]}
          </Button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={range.from}
            max={range.to}
            onChange={(e) => onCustomChange({ ...range, from: e.target.value, preset: "custom" })}
            className="h-8 w-[140px] text-xs"
          />
          <Input
            type="date"
            value={range.to}
            min={range.from}
            onChange={(e) => onCustomChange({ ...range, to: e.target.value, preset: "custom" })}
            className="h-8 w-[140px] text-xs"
          />
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ height: CHART_HEIGHT }}>{children}</div>
      </CardContent>
    </Card>
  );
}

interface AlertItem {
  key: string;
  label: string;
  count: number;
  icon: typeof AlertTriangle;
  tone: "danger" | "warning" | "info";
  onClick?: () => void;
}

function AlertsGrid({
  alerts,
  loading,
  onNavigate,
}: {
  alerts?: {
    criticalStock: number;
    overdueAccounts: number;
    pendingPix: number;
    overdueCharges: number;
    openCashSessions: number;
  };
  loading?: boolean;
  onNavigate: (to: string) => void;
}) {
  const items: AlertItem[] = [
    {
      key: "stock",
      label: "Estoque crítico",
      count: alerts?.criticalStock ?? 0,
      icon: Boxes,
      tone: "warning",
      onClick: () => onNavigate(ROUTES.inventory),
    },
    {
      key: "overdue",
      label: "Contas vencidas",
      count: alerts?.overdueAccounts ?? 0,
      icon: AlertTriangle,
      tone: "danger",
      onClick: () => onNavigate(ROUTES.finance),
    },
    {
      key: "pix",
      label: "PIX pendentes",
      count: alerts?.pendingPix ?? 0,
      icon: Zap,
      tone: "info",
      onClick: () => onNavigate(ROUTES.bellaPay),
    },
    {
      key: "charges",
      label: "Cobranças vencidas",
      count: alerts?.overdueCharges ?? 0,
      icon: AlertTriangle,
      tone: "danger",
      onClick: () => onNavigate(ROUTES.bellaPay),
    },
    {
      key: "cash",
      label: "Caixa aberto",
      count: alerts?.openCashSessions ?? 0,
      icon: Wallet,
      tone: "info",
      onClick: () => onNavigate(ROUTES.cash),
    },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((it) => {
        const Icon = it.icon;
        const active = it.count > 0;
        const tone =
          active && it.tone === "danger"
            ? "border-destructive/40 bg-destructive/5 text-destructive"
            : active && it.tone === "warning"
              ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
              : active && it.tone === "info"
                ? "border-primary/40 bg-primary/5 text-primary"
                : "border-border bg-card text-muted-foreground";
        return (
          <button
            key={it.key}
            type="button"
            onClick={it.onClick}
            className={cn(
              "flex items-center justify-between rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              tone,
            )}
          >
            <div className="min-w-0">
              <p className="truncate text-xs font-medium uppercase tracking-wide opacity-80">
                {it.label}
              </p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">
                {loading ? "—" : formatNumber(it.count)}
              </p>
            </div>
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background/60">
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
          </button>
        );
      })}
    </section>
  );
}

function RankingCard({
  title,
  items,
  loading,
  onItemClick,
}: {
  title: string;
  items: { id: string; primary: string; secondary: string; value: string }[];
  loading?: boolean;
  onItemClick?: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title="Sem dados" description="Nada para exibir no período." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it, idx) => (
              <li key={it.id || idx}>
                <button
                  type="button"
                  onClick={onItemClick ? () => onItemClick(it.id) : undefined}
                  disabled={!onItemClick}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 py-2 text-left",
                    onItemClick && "cursor-pointer rounded px-1 hover:bg-accent",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-grid h-6 w-6 shrink-0 place-items-center rounded-md bg-muted text-[11px] font-semibold text-muted-foreground">
                      {idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{it.primary}</p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {it.secondary}
                      </p>
                    </div>
                  </div>
                  <span className="whitespace-nowrap text-sm font-semibold tabular-nums">
                    {it.value}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
