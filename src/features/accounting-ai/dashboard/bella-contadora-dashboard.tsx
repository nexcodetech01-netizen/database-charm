import { CalendarCheck, Calculator, HandCoins, TrendingUp, Wallet } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { PageLayout } from "@/components/layout";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  BellaChatPanel,
  BellaNotificationCenter,
  BellaBriefCard,
  FinancialCard,
  IndicatorCard,
  SummaryGrid,
} from "../components";
import { useEffect, useMemo } from "react";
import { useBellaDashboard } from "../hooks/use-bella-dashboard";
import { accountingQueries } from "../queries";
import { buildAccountingInsights } from "../insights";
import { buildFinancialAdvice } from "../advisor";
import { BellaTaxBlock } from "../tax";
import { BellaAuditBlock } from "../audit";
import {
  bellaNotificationStore,
  buildBellaNotifications,
  useBellaNotifications,
} from "../proactive";
import type { AccountingSummary } from "../types";
import { useFinancialCategories } from "@/features/finance/hooks/use-finance";
import {
  useMonthlySummary,
  useWithdrawalCapacity,
} from "../monthly-closing/hooks/use-monthly-summary";
import { partnerNamesFrom, planWithdrawals } from "../monthly-closing/lib/withdrawal-split";

const pct = (v: number) => `${v.toFixed(2).replace(".", ",")}%`;



export interface BellaContadoraDashboardProps {
  companyId: string;
}

export function BellaContadoraDashboard({ companyId }: BellaContadoraDashboardProps) {
  // Sprint 7.2.1: uma única leitura resolve summary + tributário + auditoria
  // em paralelo (Promise.all no BellaContext), sem waterfalls entre blocos.
    const { summary, tax, audit, isLoading } = useBellaDashboard(companyId);
  const s = (summary ?? undefined) as AccountingSummary | undefined;


  // Números do topo = mesma fonte do Fechamento do mês (monthly_closing_summary
  // + compute_prolabore_safe_amount). Antes vinham da DRE contábil, do saldo e
  // de fórmulas próprias, e não batiam com o fechamento.
  const month = currentMonthKey();
  const monthSummaryQ = useMonthlySummary(companyId, month);
  const capacityQ = useWithdrawalCapacity(companyId, true);
  const { data: financialCategories } = useFinancialCategories(companyId);
  const monthSummary = monthSummaryQ.data;
  const capacity = capacityQ.data;
  const withdrawalPlan = useMemo(
    () =>
      planWithdrawals({
        partnerNames: partnerNamesFrom((financialCategories ?? []).map((c) => c.name)),
        withdrawals: monthSummary?.withdrawals ?? [],
        safeAmount: capacity?.safe_amount ?? null,
        cashBalance: capacity?.cash_balance ?? 0,
      }),
    [financialCategories, monthSummary, capacity],
  );
  const perPartner = withdrawalPlan.partners[0]?.available ?? 0;
  const cardsLoading = monthSummaryQ.isLoading || capacityQ.isLoading;

  const cards = [
    {
      label: "Vendas do mês",
      icon: TrendingUp,
      value: monthSummary ? formatCurrency(monthSummary.revenue) : "—",
      hint: monthSummary
        ? `Recebido ${formatCurrency(monthSummary.received_revenue)} · a receber ${formatCurrency(monthSummary.pending_revenue)}`
        : undefined,
    },
    {
      label: "Lucro do mês",
      icon: Calculator,
      value: monthSummary ? formatCurrency(monthSummary.profit) : "—",
      hint: "Vendas − custo das peças − despesas",
      highlight: true,
    },
    {
      label: "Dinheiro nas contas",
      icon: Wallet,
      value: capacity ? formatCurrency(capacity.cash_balance) : "—",
      hint: "Banco + gaveta",
    },
    {
      label: "Pode retirar agora",
      icon: HandCoins,
      value: capacity ? formatCurrency(withdrawalPlan.availableTotal) : "—",
      hint: capacity
        ? withdrawalPlan.partners.length > 1
          ? `${formatCurrency(perPartner)} para cada sócia`
          : undefined
        : undefined,
    },
  ];

  const insights = useMemo(() => buildAccountingInsights(s), [s]);
  const advice = useMemo(() => (s ? buildFinancialAdvice({ summary: s }) : null), [s]);

  const proactive = useMemo(
    () => buildBellaNotifications({ summary: s ?? null, insights, advice }),
    [s, insights, advice],
  );
  useEffect(() => {
    bellaNotificationStore.setNotifications(proactive);
  }, [proactive]);
    const { notifications: allNotifications, dismiss } = useBellaNotifications();
  // Pró-labore usa outra fórmula e conflitava com o "Pode retirar agora".
  const notifications = useMemo(
    () => allNotifications.filter((n) => !n.id.startsWith("prolabore")),
    [allNotifications],
  );

  const stagnant = s?.products.data?.stagnant ?? [];
  const champions = s?.products.data?.bestSellers ?? [];
  const worst = s?.products.data?.worstSellers ?? [];
  const topCustomers = s?.customers.data?.topCustomers ?? [];
  

  const highlights = useMemo(
    () =>
      s
        ? [
            accountingQueries.produtoMaisVendido(s),
            accountingQueries.produtoMenosVendido(s),
            accountingQueries.clienteQueMaisCompra(s),
            accountingQueries.clienteMaiorFaturamento(s),
            accountingQueries.valorParadoEmEstoque(s),
          ]
        : [],
    [s],
  );

  return (
    <PageLayout
      title="Bella Contadora"
      icon={Calculator}
      description="Como está a loja este mês e o que precisa da sua atenção."
      meta={
        <Button asChild size="sm">
          <Link to="/bella-contadora/fechamento-mensal">
            <CalendarCheck className="mr-1.5 h-4 w-4" /> Fechamento do mês
          </Link>
        </Button>
      }
      kpis={
        <SummaryGrid columns={4}>
          {cards.map((c) => (
            <FinancialCard
              key={c.label}
              label={c.label}
              value={c.value}
              hint={c.hint}
              icon={c.icon}
              loading={cardsLoading}
              unavailable={!cardsLoading && c.value === "—"}
              highlight={c.highlight}
            />
          ))}
        </SummaryGrid>
      }
    >
      <div className="mx-auto max-w-4xl space-y-4">
        <BellaNotificationCenter
          notifications={notifications}
          loading={isLoading}
          limit={6}
          onDismiss={dismiss}
        />

        <BellaChatPanel companyId={companyId} />

        <details className="group rounded-2xl border bg-card">
          <summary className="cursor-pointer list-none px-4 py-3 text-sm font-semibold">
            <span className="group-open:hidden">▸ Ver mais detalhes</span>
            <span className="hidden group-open:inline">▾ Ocultar detalhes</span>
            <span className="ml-2 font-normal text-muted-foreground">
              resumo, impostos, auditoria, indicadores e rankings
            </span>
          </summary>
          <div className="space-y-3 border-t p-3">
            <BellaBriefCard summary={s} loading={isLoading} />

            <BellaAuditBlock companyId={companyId} preloaded={audit} loading={isLoading} />

            <BellaTaxBlock companyId={companyId} preloaded={tax} loading={isLoading} />

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
                <RankingList title="Produtos campeões" empty="Sem vendas registradas no período."
                  items={champions.map((p) => ({ id: p.id, name: p.name, value: formatCurrency(p.revenue) }))} />
                <RankingList title="Menos vendidos" empty="Sem ranking disponível no período."
                  items={worst.map((p) => ({ id: p.id, name: p.name, value: formatCurrency(p.revenue) }))} />
                <RankingList title="Produtos sem giro" empty="Nenhum produto parado identificado."
                  items={stagnant.map((p) => ({ id: p.id, name: p.name, value: String(p.stock) }))} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardContent className="grid gap-4 p-4 sm:grid-cols-2">
                <RankingList title="Melhores clientes" empty="Sem clientes com compras no período."
                  items={topCustomers.map((c) => ({ id: c.id, name: c.name, value: formatCurrency(c.revenue) }))} />
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
        </details>
      </div>
    </PageLayout>
  );
}

function RankingList({
  title,
  empty,
  items,
}: {
  title: string;
  empty: string;
  items: { id: string; name: string; value: string }[];
}) {
  return (
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.length === 0 ? (
          <li>{empty}</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <span className="truncate">{item.name}</span>
              <span className="tabular-nums">{item.value}</span>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
