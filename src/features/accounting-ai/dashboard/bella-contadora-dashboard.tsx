import {
  Boxes,
  Calculator,
  Coins,
  HandCoins,
  HeartPulse,
  PiggyBank,
  Receipt,
  ShoppingCart,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import { PageLayout } from "@/components/layout";
import { formatCurrency } from "@/lib/format";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertCard,
  BellaBriefCard,
  FinancialCard,
  IndicatorCard,
  InsightCard,
  SummaryGrid,
  TrendBadge,
} from "../components";
import { useAccountingAiSummary } from "../hooks/use-accounting-ai";
import { healthLabel } from "../lib/health";
import { accountingQueries } from "../queries";
import type { AccountingSummary, ProviderResult, TrendComparison } from "../types";

const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;

function money<T>(result: ProviderResult<T> | undefined, pick: (data: T) => number) {
  if (!result?.available || !result.data) return { unavailable: true, value: "—" };
  return { unavailable: false, value: formatCurrency(pick(result.data)) };
}

function count<T>(result: ProviderResult<T> | undefined, pick: (data: T) => number) {
  if (!result?.available || !result.data) return { unavailable: true, value: "—" };
  return { unavailable: false, value: String(pick(result.data)) };
}

export interface BellaContadoraDashboardProps {
  companyId: string;
}

export function BellaContadoraDashboard({ companyId }: BellaContadoraDashboardProps) {
  const { data, isLoading } = useAccountingAiSummary(companyId);
  const s = data as AccountingSummary | undefined;

  const trends = s?.trends.data;
  const health = s?.health.data;

  const cards: {
    label: string;
    icon: typeof Wallet;
    value: string;
    unavailable: boolean;
    hint?: string;
    trend?: TrendComparison | null;
    highlight?: boolean;
  }[] = [
    {
      label: "Receita hoje",
      icon: TrendingUp,
      ...money(s?.today, (d) => d.total),
      hint: s?.today.data ? `${s.today.data.count} venda(s) hoje` : undefined,
      trend: trends?.todayVsYesterday ?? null,
    },
    {
      label: "Receita do mês",
      icon: TrendingUp,
      ...money(s?.revenue, (d) => d.netRevenue),
      hint: "Receita líquida do período",
      trend: trends?.monthVsPreviousRevenue ?? null,
    },
    {
      label: "Lucro bruto",
      icon: Coins,
      ...money(s?.profit, (d) => d.grossProfit),
      hint: s?.profit.data ? pct(s.profit.data.grossMargin) : undefined,
    },
    {
      label: "Lucro líquido",
      icon: Calculator,
      ...money(s?.profit, (d) => d.netProfit),
      hint: s?.profit.data ? pct(s.profit.data.netMargin) : undefined,
      trend: trends?.monthVsPreviousProfit ?? null,
      highlight: true,
    },
    { label: "Caixa disponível", icon: Wallet, ...money(s?.cash, (d) => d.currentBalance), hint: "Saldo atual das contas" },
    {
      label: "Contas a pagar",
      icon: TrendingDown,
      ...money(s?.cash, (d) => d.payable),
    },
    {
      label: "Contas a receber",
      icon: HandCoins,
      ...money(s?.cash, (d) => d.receivable),
      hint: s?.cash.data ? `Vencidas ${formatCurrency(s.cash.data.receivableOverdue)}` : undefined,
    },
    {
      label: "Ticket médio",
      icon: ShoppingCart,
      ...money(s?.ticket, (d) => d.averageTicket),
      hint: s?.ticket.data ? `${s.ticket.data.salesCount} vendas` : undefined,
    },
    {
      label: "Estoque",
      icon: Boxes,
      ...money(s?.inventory, (d) => d.inventoryValue),
      hint: s?.inventory.data ? `${s.inventory.data.productCount} produtos` : undefined,
    },
    {
      label: "Produtos sem giro",
      icon: PiggyBank,
      ...count(s?.inventory, (d) => d.stagnantCount),
      hint: s?.inventory.data ? `${s.inventory.data.belowMinCount} abaixo do mínimo` : undefined,
    },
    {
      label: "Clientes ativos",
      icon: Users,
      ...count(s?.customers, (d) => d.active),
      hint: s?.customers.data ? `${s.customers.data.total} cadastrados` : undefined,
    },
    {
      label: "Saúde financeira",
      icon: HeartPulse,
      unavailable: !health,
      value: health ? `${healthLabel(health)} · ${health.score}/100` : "—",
    },
    {
      label: "Impostos",
      icon: Receipt,
      ...money(s?.taxes, (d) => d.taxAmount),
      hint: s?.taxes.data ? `Competência ${s.taxes.data.competence}` : undefined,
    },
  ];

  const stagnant = s?.products.data?.stagnant ?? [];
  const champions = s?.products.data?.bestSellers ?? [];
  const worst = s?.products.data?.worstSellers ?? [];
  const topCustomers = s?.customers.data?.topCustomers ?? [];
  const warnings = health?.warnings ?? [];

  const highlights = s
    ? [
        accountingQueries.produtoMaisVendido(s),
        accountingQueries.produtoMenosVendido(s),
        accountingQueries.clienteQueMaisCompra(s),
        accountingQueries.clienteMaiorFaturamento(s),
        accountingQueries.valorParadoEmEstoque(s),
      ]
    : [];

  return (
    <PageLayout
      title="Bella Contadora"
      icon={Calculator}
      description="Leitura contábil e financeira consolidada — somente leitura, a partir dos motores já existentes do NexOS."
      meta={
        s?.period ? (
          <Badge variant="outline" className="rounded-lg font-normal">
            {s.period.label ?? `${s.period.start} → ${s.period.end}`}
          </Badge>
        ) : null
      }
      kpis={
        <SummaryGrid columns={4}>
          {cards.map((c) => (
            <FinancialCard
              key={String(c.label)}
              label={c.label}
              value={c.value}
              hint={c.hint}
              trend={c.trend !== undefined ? <TrendBadge trend={c.trend} /> : undefined}
              icon={c.icon}
              loading={isLoading}
              unavailable={c.unavailable}
              highlight={c.highlight}
            />
          ))}
        </SummaryGrid>
      }
    >
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <BellaBriefCard summary={s} loading={isLoading} />

          <Card className="rounded-2xl">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-semibold">Indicadores do período</p>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <IndicatorCard
                  label="Margem líquida"
                  value={s?.margin.data ? pct(s.margin.data.netMargin) : "—"}
                  loading={isLoading}
                />
                <IndicatorCard
                  label="Margem EBITDA"
                  value={s?.margin.data ? pct(s.margin.data.ebitdaMargin) : "—"}
                  loading={isLoading}
                />
                <IndicatorCard
                  label="Ticket médio"
                  value={s?.ticket.data ? formatCurrency(s.ticket.data.averageTicket) : "—"}
                  reference={s?.ticket.data ? `${s.ticket.data.salesCount} vendas` : undefined}
                  loading={isLoading}
                />
                <IndicatorCard
                  label="Ponto de equilíbrio"
                  value={s?.margin.data ? formatCurrency(s.margin.data.breakEven) : "—"}
                  loading={isLoading}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="grid gap-4 p-4 sm:grid-cols-3">
              <div>
                <p className="text-sm font-semibold">Produtos campeões</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {champions.length === 0 ? (
                    <li>Sem vendas registradas no período.</li>
                  ) : (
                    champions.map((p) => (
                      <li key={p.id} className="flex justify-between gap-3">
                        <span className="truncate">{p.name}</span>
                        <span className="tabular-nums">{formatCurrency(p.revenue)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold">Menos vendidos</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {worst.length === 0 ? (
                    <li>Sem ranking disponível no período.</li>
                  ) : (
                    worst.map((p) => (
                      <li key={p.id} className="flex justify-between gap-3">
                        <span className="truncate">{p.name}</span>
                        <span className="tabular-nums">{formatCurrency(p.revenue)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold">Produtos sem giro</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {stagnant.length === 0 ? (
                    <li>Nenhum produto parado identificado.</li>
                  ) : (
                    stagnant.map((p) => (
                      <li key={p.id} className="flex justify-between gap-3">
                        <span className="truncate">{p.name}</span>
                        <span className="tabular-nums">{p.stock}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
              <div>
                <p className="text-sm font-semibold">Melhores clientes</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {topCustomers.length === 0 ? (
                    <li>Sem clientes com compras no período.</li>
                  ) : (
                    topCustomers.map((c) => (
                      <li key={c.id} className="flex justify-between gap-3">
                        <span className="truncate">{c.name}</span>
                        <span className="tabular-nums">{formatCurrency(c.revenue)}</span>
                      </li>
                    ))
                  )}
                </ul>
              </div>
              <div>
                <p className="text-sm font-semibold">Consultas da Bella</p>
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {highlights.length === 0 ? (
                    <li>Sem dados no período.</li>
                  ) : (
                    highlights.map((h) => <li key={h.id}>{h.text}</li>)
                  )}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-3">
          <InsightCard
            title={
              health ? `Saúde do negócio: ${healthLabel(health)} (${health.score}/100)` : "Saúde do negócio"
            }
            description={
              health?.highlights.length
                ? health.highlights.join(" ")
                : "A Bella lê apenas os motores existentes: sem lançamentos no período, não há diagnóstico."
            }
            footer="Fonte: motor contábil, financeiro, fiscal, estoque e vendas."
          />
          {warnings.slice(0, 4).map((w) => (
            <AlertCard key={w} title={w} tone="warning" />
          ))}
        </div>
      </div>
    </PageLayout>
  );
}
