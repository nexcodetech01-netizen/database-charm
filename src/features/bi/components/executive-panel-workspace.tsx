import { useMemo, useState } from "react";
import {
  Banknote,
  BarChart3,
  Boxes,
  Package,
  Percent,
  Receipt,
  ShoppingCart,
  Sparkle,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageLayout, KpiSection, KpiCard } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/layout/empty-state";
import { formatCurrency, formatNumber } from "@/lib/format";
import {
  DateRangePicker,
  rangeFromPreset,
} from "@/features/reports";
import type { DateRange } from "@/features/reports/types";
import { ExportButtons } from "@/features/reports/components/export-buttons";
import { useExecutivePanel } from "../hooks/use-executive-panel";
import type {
  BiAbcItem,
  BiExecutivePanel,
  BiRankedCategory,
  BiRankedProduct,
} from "../types";
import { BiScopeFilters } from "./bi-scope-filters";

const CHART_HEIGHT = 240;

/* ------------------------------------------------------------------ */
/* Workspace                                                           */
/* ------------------------------------------------------------------ */

export function ExecutivePanelWorkspace({ companyId }: { companyId: string }) {
  const [range, setRange] = useState<DateRange>(() =>
    rangeFromPreset("last_30_days"),
  );
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [supplierId, setSupplierId] = useState<string | null>(null);

  const { data, isLoading, error } = useExecutivePanel({
    companyId,
    range,
    categoryId,
    supplierId,
  });

  const exportRows = useMemo(() => {
    if (!data) return [];
    const k = data.kpis;
    return [
      { Indicador: "Receita bruta", Valor: formatCurrency(k.revenue) },
      { Indicador: "Receita líquida", Valor: formatCurrency(k.netRevenue) },
      { Indicador: "Taxas de recebimento", Valor: formatCurrency(k.paymentFees) },
      { Indicador: "Lucro líquido", Valor: formatCurrency(k.grossProfit) },
      { Indicador: "Margem líquida", Valor: `${(k.grossMargin * 100).toFixed(1)}%` },
      { Indicador: "Ticket médio", Valor: formatCurrency(k.avgTicket) },
      { Indicador: "Vendas", Valor: k.salesCount },
      { Indicador: "Produtos vendidos", Valor: k.productsSold },
      { Indicador: "Clientes ativos", Valor: k.activeCustomers },
      { Indicador: "Novos clientes", Valor: k.newCustomers },
      { Indicador: "Valor do estoque", Valor: formatCurrency(data.inventory.value) },
      {
        Indicador: "Cobertura (dias)",
        Valor: data.inventory.coverageDays ?? "—",
      },
      { Indicador: "Receber", Valor: formatCurrency(data.finance.receivable) },
      { Indicador: "Pagar", Valor: formatCurrency(data.finance.payable) },
    ];
  }, [data]);

  return (
    <PageLayout
      icon={BarChart3}
      title="Painel Executivo"
      description="Visão consolidada para tomada de decisão. Indicadores comerciais, estoque, financeiro e fornecedores."
      actions={
        <>
          <BiScopeFilters
            companyId={companyId}
            categoryId={categoryId}
            supplierId={supplierId}
            onCategoryChange={setCategoryId}
            onSupplierChange={setSupplierId}
          />
          <DateRangePicker value={range} onChange={setRange} />
          <ExportButtons
            filename="painel-executivo"
            title="Painel Executivo"
            rows={exportRows}
            disabled={!data}
          />
        </>
      }
      kpis={
        <KpiSection columns={4}>
          <KpiCard
            label="Receita bruta"
            value={data ? formatCurrency(data.kpis.revenue) : "R$ 0,00"}
            hint={
              data
                ? `Líquido: ${formatCurrency(data.kpis.netRevenue)}`
                : undefined
            }
            icon={Banknote}
            loading={isLoading}
          />
          <KpiCard
            label="Lucro líquido"
            value={data ? formatCurrency(data.kpis.grossProfit) : "R$ 0,00"}
            hint={
              data
                ? `${(data.kpis.grossMargin * 100).toFixed(1)}% de margem líquida`
                : undefined
            }
            icon={TrendingUp}
            loading={isLoading}
          />
          <KpiCard
            label="Ticket médio"
            value={data ? formatCurrency(data.kpis.avgTicket) : "R$ 0,00"}
            hint={data ? `${formatNumber(data.kpis.salesCount)} vendas` : undefined}
            icon={Receipt}
            loading={isLoading}
          />
          <KpiCard
            label="Produtos vendidos"
            value={data ? formatNumber(data.kpis.productsSold) : "0"}
            icon={Package}
            loading={isLoading}
          />
          <KpiCard
            label="Clientes ativos"
            value={data ? formatNumber(data.kpis.activeCustomers) : "0"}
            hint={data ? `${formatNumber(data.kpis.newCustomers)} novos no período` : undefined}
            icon={Users}
            loading={isLoading}
          />
          <KpiCard
            label="Valor em estoque"
            value={data ? formatCurrency(data.inventory.value) : "R$ 0,00"}
            hint={data ? `${formatNumber(data.inventory.totalUnits)} un.` : undefined}
            icon={Boxes}
            loading={isLoading}
          />
          <KpiCard
            label="A receber"
            value={data ? formatCurrency(data.finance.receivable) : "R$ 0,00"}
            icon={ShoppingCart}
            loading={isLoading}
          />
          <KpiCard
            label="A pagar"
            value={data ? formatCurrency(data.finance.payable) : "R$ 0,00"}
            icon={Percent}
            loading={isLoading}
          />
        </KpiSection>
      }
    >
      {error ? (
        <Card>
          <CardContent className="p-6 text-sm text-destructive">
            Falha ao carregar os indicadores. Tente novamente.
          </CardContent>
        </Card>
      ) : null}

      <Tabs defaultValue="visao-geral" className="space-y-3">
        <TabsList className="flex flex-wrap gap-1">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="comercial">Comercial</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="fornecedores">Fornecedores</TabsTrigger>
          <TabsTrigger value="abc">Curva ABC</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="mt-0 space-y-4">
          <OverviewSection data={data} loading={isLoading} />
        </TabsContent>
        <TabsContent value="comercial" className="mt-0 space-y-4">
          <CommercialSection data={data} loading={isLoading} />
        </TabsContent>
        <TabsContent value="estoque" className="mt-0 space-y-4">
          <InventorySection data={data} loading={isLoading} />
        </TabsContent>
        <TabsContent value="financeiro" className="mt-0 space-y-4">
          <FinanceSection data={data} loading={isLoading} />
        </TabsContent>
        <TabsContent value="fornecedores" className="mt-0 space-y-4">
          <SuppliersSection data={data} loading={isLoading} />
        </TabsContent>
        <TabsContent value="abc" className="mt-0 space-y-4">
          <AbcSection data={data} loading={isLoading} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function ChartFrame({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
        {action}
      </CardHeader>
      <CardContent className="pt-0">
        <div style={{ height: CHART_HEIGHT }}>{children}</div>
      </CardContent>
    </Card>
  );
}

function LoadingChart() {
  return <Skeleton className="h-full w-full" />;
}

function OverviewSection({
  data,
  loading,
}: {
  data?: BiExecutivePanel;
  loading?: boolean;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartFrame title="Receita — últimos 30 dias">
        {loading || !data ? (
          <LoadingChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.charts.revenue30d}>
              <defs>
                <linearGradient id="rev30" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area dataKey="value" stroke="#2563EB" fill="url(#rev30)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartFrame>

      <ChartFrame title="Lucro bruto — últimos 30 dias">
        {loading || !data ? (
          <LoadingChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data.charts.profit30d}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Line dataKey="value" stroke="#16A34A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </ChartFrame>

      <ChartFrame title="Vendas — últimos 30 dias">
        {loading || !data ? (
          <LoadingChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.charts.salesCount30d}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} width={40} />
              <Tooltip formatter={(v: number) => formatNumber(v)} />
              <Bar dataKey="value" fill="#6366F1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartFrame>

      <ChartFrame title="Receita — 7 vs 90 dias">
        {loading || !data ? (
          <LoadingChart />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.charts.revenue90d}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={9} />
              <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => formatCurrency(v)} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Area dataKey="value" stroke="#0EA5E9" fill="#0EA5E9" fillOpacity={0.15} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </ChartFrame>
    </div>
  );
}

function ProductTable({
  title,
  items,
  metric,
}: {
  title: string;
  items: BiRankedProduct[];
  metric: "quantity" | "profit";
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <EmptyState title="Sem dados" description="Nenhuma venda no período." />
        ) : (
          <ul className="divide-y divide-border">
            {items.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {p.sku ?? "—"} · {formatNumber(p.quantity)} un.
                  </p>
                </div>
                <div className="text-right text-xs">
                  <div className="font-semibold">
                    {metric === "quantity"
                      ? formatNumber(p.quantity)
                      : formatCurrency(p.profit)}
                  </div>
                  <div className="text-muted-foreground">
                    {formatCurrency(p.revenue)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function CommercialSection({
  data,
  loading,
}: {
  data?: BiExecutivePanel;
  loading?: boolean;
}) {
  if (loading || !data) {
    return <Skeleton className="h-64 w-full" />;
  }
  const c = data.commercial;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <ProductTable
          title="Top produtos por volume"
          items={c.topSelling}
          metric="quantity"
        />
        <ProductTable
          title="Top produtos por lucro"
          items={c.topProfitable}
          metric="profit"
        />
      </div>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Categorias mais lucrativas</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {c.topProfitableCategories.length === 0 ? (
            <EmptyState title="Sem dados" description="Nenhuma venda categorizada." />
          ) : (
            <CategoryList items={c.topProfitableCategories} />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Produtos sem venda</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <Tabs defaultValue="30">
            <TabsList>
              <TabsTrigger value="30">30 dias</TabsTrigger>
              <TabsTrigger value="60">60 dias</TabsTrigger>
              <TabsTrigger value="90">90 dias</TabsTrigger>
            </TabsList>
            <TabsContent value="30">
              <StagnantList items={c.noSales.d30} />
            </TabsContent>
            <TabsContent value="60">
              <StagnantList items={c.noSales.d60} />
            </TabsContent>
            <TabsContent value="90">
              <StagnantList items={c.noSales.d90} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryList({ items }: { items: BiRankedCategory[] }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((c) => (
        <li key={c.id} className="flex items-center justify-between py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{c.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {formatNumber(c.quantity)} un. · {(c.margin * 100).toFixed(1)}% margem
            </p>
          </div>
          <div className="text-right text-xs">
            <div className="font-semibold">{formatCurrency(c.profit)}</div>
            <div className="text-muted-foreground">{formatCurrency(c.revenue)}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StagnantList({
  items,
}: {
  items: BiExecutivePanel["commercial"]["noSales"]["d30"];
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={Sparkle}
        title="Nada estagnado"
        description="Todos os produtos ativos tiveram venda no período."
      />
    );
  }
  return (
    <ul className="divide-y divide-border">
      {items.map((p) => (
        <li key={p.id} className="flex items-center justify-between py-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{p.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {p.sku ?? "—"} ·{" "}
              {p.lastSaleAt
                ? `Última venda: ${p.lastSaleAt}`
                : "Nunca vendido"}
            </p>
          </div>
          <Badge variant="secondary" className="text-[10px]">
            {formatNumber(p.stock)} un.
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function InventorySection({
  data,
  loading,
}: {
  data?: BiExecutivePanel;
  loading?: boolean;
}) {
  if (loading || !data) return <Skeleton className="h-64 w-full" />;
  const inv = data.inventory;
  return (
    <div className="space-y-4">
      <KpiSection columns={4}>
        <KpiCard
          label="Valor total"
          value={formatCurrency(inv.value)}
          icon={Boxes}
        />
        <KpiCard label="Unidades" value={formatNumber(inv.totalUnits)} icon={Package} />
        <KpiCard
          label="Cobertura"
          value={inv.coverageDays !== null ? `${inv.coverageDays} d` : "—"}
          hint="Estoque ÷ giro diário"
          icon={Percent}
        />
        <KpiCard
          label="Giro"
          value={`${(inv.turnover * 100).toFixed(1)}%`}
          hint="Saídas ÷ estoque"
          icon={TrendingUp}
        />
      </KpiSection>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Produtos críticos (estoque ≤ mínimo)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {inv.critical.length === 0 ? (
            <EmptyState title="Sem alertas" description="Nenhum produto abaixo do mínimo." />
          ) : (
            <ul className="divide-y divide-border">
              {inv.critical.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {p.sku ?? "—"}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <Badge variant="destructive" className="text-[10px]">
                      {formatNumber(p.stock)} / {formatNumber(p.min_stock)}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FinanceSection({
  data,
  loading,
}: {
  data?: BiExecutivePanel;
  loading?: boolean;
}) {
  if (loading || !data) return <Skeleton className="h-64 w-full" />;
  const f = data.finance;
  return (
    <div className="space-y-4">
      <KpiSection columns={4}>
        <KpiCard label="Entradas" value={formatCurrency(f.income)} icon={Banknote} />
        <KpiCard label="Saídas" value={formatCurrency(f.expense)} icon={Banknote} />
        <KpiCard label="Saldo" value={formatCurrency(f.balance)} icon={TrendingUp} />
        <KpiCard
          label="Receber / Pagar"
          value={`${formatCurrency(f.receivable)} / ${formatCurrency(f.payable)}`}
          icon={Percent}
        />
      </KpiSection>
      <ChartFrame title="Fluxo diário">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={f.dailyFlow}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} width={70} tickFormatter={(v) => formatCurrency(v)} />
            <Tooltip formatter={(v: number) => formatCurrency(v)} />
            <Line dataKey="income" stroke="#16A34A" dot={false} name="Entradas" />
            <Line dataKey="expense" stroke="#DC2626" dot={false} name="Saídas" />
            <Line dataKey="balance" stroke="#2563EB" dot={false} name="Saldo" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>
    </div>
  );
}

function SuppliersSection({
  data,
  loading,
}: {
  data?: BiExecutivePanel;
  loading?: boolean;
}) {
  if (loading || !data) return <Skeleton className="h-64 w-full" />;
  const s = data.suppliers;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Maior volume comprado</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {s.topByVolume.length === 0 ? (
            <EmptyState title="Sem dados" description="Nenhuma compra no período." />
          ) : (
            <ul className="divide-y divide-border">
              {s.topByVolume.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span className="truncate text-sm">{r.name}</span>
                  <span className="text-xs font-semibold">
                    {formatNumber(r.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Maior faturamento</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {s.topByRevenue.length === 0 ? (
            <EmptyState title="Sem dados" description="Nenhuma compra no período." />
          ) : (
            <ul className="divide-y divide-border">
              {s.topByRevenue.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span className="truncate text-sm">{r.name}</span>
                  <span className="text-xs font-semibold">
                    {formatCurrency(r.total)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Aumento de custo (vs. período anterior)</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          {s.topByCostIncrease.length === 0 ? (
            <EmptyState title="Sem variações" description="Sem histórico comparável." />
          ) : (
            <ul className="divide-y divide-border">
              {s.topByCostIncrease.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{r.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatCurrency(r.previousAvgCost)} → {formatCurrency(r.currentAvgCost)}
                    </p>
                  </div>
                  <Badge variant="destructive" className="text-[10px]">
                    +{(r.increasePct * 100).toFixed(1)}%
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AbcSection({
  data,
  loading,
}: {
  data?: BiExecutivePanel;
  loading?: boolean;
}) {
  if (loading || !data) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <AbcCard title="Produtos" items={data.abc.products} />
      <AbcCard title="Categorias" items={data.abc.categories} />
      <AbcCard title="Clientes" items={data.abc.customers} />
    </div>
  );
}

function AbcCard({ title, items }: { title: string; items: BiAbcItem[] }) {
  const counts = { A: 0, B: 0, C: 0 };
  for (const i of items) counts[i.class] += 1;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span>{title}</span>
          <div className="flex gap-1">
            <ClassPill cls="A" count={counts.A} />
            <ClassPill cls="B" count={counts.B} />
            <ClassPill cls="C" count={counts.C} />
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {items.length === 0 ? (
          <EmptyState title="Sem dados" description="Sem receita no período." />
        ) : (
          <ul className="divide-y divide-border">
            {items.slice(0, 15).map((i) => (
              <li key={i.id} className="flex items-center gap-2 py-2">
                <ClassPill cls={i.class} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{i.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {(i.share * 100).toFixed(1)}% · acum {(i.cumulativeShare * 100).toFixed(1)}%
                  </p>
                </div>
                <span className="text-xs font-semibold">
                  {formatCurrency(i.revenue)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ClassPill({ cls, count }: { cls: "A" | "B" | "C"; count?: number }) {
  const tone =
    cls === "A"
      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
      : cls === "B"
        ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
        : "bg-slate-500/15 text-slate-600 dark:text-slate-400";
  return (
    <span
      className={`inline-flex min-w-[1.5rem] items-center justify-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${tone}`}
    >
      {cls}
      {count !== undefined ? ` ${count}` : ""}
    </span>
  );
}
