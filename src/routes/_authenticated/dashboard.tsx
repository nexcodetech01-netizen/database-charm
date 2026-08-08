import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import {
  AlertTriangle,
  BarChart3,
  Calendar as CalendarIcon,
  DollarSign,
  HelpCircle,
  LineChart,
  Package,
  PackageMinus,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import {
  ActionToolbar,
  EntityHeader,
  MetricCard,
  MetricGrid,
  Panel,
  Section,
  StatStack,
  StatusBadge,
} from "@/components/design";
import { ErrorBoundary } from "react-error-boundary";
import { Button } from "@/components/ui/button";
import { SPACING_TOKENS, TEXT_TOKENS } from "@/design";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/config/routes";
import { ActionCenter } from "@/features/dashboard/components/action-center";
import { HeroMetric } from "@/features/dashboard/components/hero-metric";
import {
  InsightCards,
  type InsightCardItem,
} from "@/features/dashboard/components/insight-cards";
import { BellaDailyBriefCard } from "@/features/bella-ai/components/bella-daily-brief-card";
import { useBellaHomeSnapshot } from "@/features/bella-ai/hooks/use-bella-dashboard";
import { useSaleMetrics, salesKeys } from "@/features/sales/hooks/use-sales";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useInventoryMetrics, inventoryKeys } from "@/features/inventory/hooks/use-inventory";
import { useFinanceOverview, financeKeys } from "@/features/finance/hooks/use-finance";
import { formatCurrency } from "@/lib/format";
import { WhatsAppUsageCard } from "@/features/whatsapp";
import { CashClosingReminder } from "@/features/cash";
import { useMobileDashboardRefresh } from "@/hooks/use-mobile-dashboard-refresh";
import { requirePermission } from "@/features/rbac";
import { InterestDashboardCard } from "@/features/interests";
import { RevenueAuditDialog } from "@/features/sales/components/revenue-audit-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { subDays, startOfMonth, endOfMonth, format, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";

export const Route = createFileRoute("/_authenticated/dashboard")({
  beforeLoad: requirePermission("dashboard.view"),
  component: DashboardPage,
});

function timeGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

/**
 * Dashboard Executivo (EPIC UI.2 · Sprint UI.2.1).
 *
 * Reescrita **exclusivamente visual**: hooks, queries, permissões, serviços e
 * cálculos permanecem exatamente os mesmos da versão anterior. A sprint apenas
 * reorganiza a hierarquia (EntityHeader → Hero KPI → MetricGrid → 2 colunas →
 * Eventos → Atividade) usando o Design System UI.1.
 */
function DashboardPage() {
  const { user, company } = Route.useRouteContext();
  const navigate = useNavigate();
  const first =
    ((user.user_metadata?.full_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "por aí")
      .split(" ")[0];

  // Isolamento de homologação: por padrão os indicadores ignoram vendas de teste.
  const [includeHomologation, setIncludeHomologation] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [period, setPeriod] = useState<"today" | "yesterday" | "7d" | "month" | "custom">("today");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const timeZone = "America/Sao_Paulo";
  
  const range = useMemo(() => {
    const now = new Date();
    // Em um ambiente real, poderíamos usar date-fns-tz, mas para filtros de UI simples 
    // a manipulação de datas do JS/date-fns atende ao requisito de passar os parâmetros
    // de data (YYYY-MM-DD) para a RPC.
    
    let from: Date;
    let to: Date = now;

    switch (period) {
      case "yesterday":
        from = subDays(now, 1);
        to = subDays(now, 1);
        break;
      case "7d":
        from = subDays(now, 6); // Hoje + 6 dias atrás = 7 dias
        break;
      case "month":
        from = startOfMonth(now);
        to = endOfMonth(now);
        break;
      case "custom":
        if (customRange?.from) {
          from = customRange.from;
          to = customRange.to || customRange.from;
        } else {
          from = now;
        }
        break;
      case "today":
      default:
        from = now;
        to = now;
        break;
    }

    return {
      from: format(from, "yyyy-MM-dd"),
      to: format(to, "yyyy-MM-dd"),
    };
  }, [period, customRange]);

  const salesMetrics = useSaleMetrics(
    company.id,
    range,
    includeHomologation ? "all" : "production",
  );
  const inventory = useInventoryMetrics(company.id);
  const finance = useFinanceOverview(company.id);
  const bellaSnapshot = useBellaHomeSnapshot(company.id);

  // PWA / mobile: força refetch ao abrir e ao voltar ao primeiro plano.
  useMobileDashboardRefresh([
    salesKeys.metrics(company.id),
    inventoryKeys.metrics(company.id),
    financeKeys.overview(company.id),
  ]);

  // Faturamento hoje — vendas status='paid' com sale_date = company_today().
  const dayTotal = salesMetrics.data?.dayTotal ?? 0;
  const dayCount = salesMetrics.data?.dayCount ?? 0;
  const breakdown = salesMetrics.data?.breakdown ?? [];
  // Caixa disponível — fonte oficial: soma de financial_accounts ativas.
  const cash = finance.data?.currentBalance ?? 0;
  // Recebimentos ≠ faturamento: baixas efetivadas hoje (paid_at no dia da empresa).
  const receiptsToday = salesMetrics.data?.dayReceived ?? 0;
  const receiptsTodayCount = salesMetrics.data?.dayCount ?? 0;


  // Dinheiro para entrar — financial_transactions de receita com status='pending'.
  const receivable = finance.data?.pendingReceivable ?? 0;
  const receivableCount = finance.data?.pendingReceivableCount ?? 0;

  const productCount = inventory.data?.productCount ?? 0;
  const belowMin = inventory.data?.belowMin ?? [];
  const stagnant = inventory.data?.stagnant ?? [];

  const insights: InsightCardItem[] = [
    {
      id: "sales-today",
      label: "Vendas de hoje",
      value: dayCount > 0 ? `${dayCount} venda${dayCount > 1 ? "s" : ""}` : "Nenhuma venda",
      hint: dayCount > 0 ? formatCurrency(dayTotal) : "Abra o PDV para começar o dia",
      icon: ShoppingCart,
      status: dayCount > 0 ? "success" : "neutral",
    },
    {
      id: "receipts",
      label: "Recebimentos de hoje",
      value: formatCurrency(receiptsToday),
      hint:
        receiptsTodayCount > 0
          ? `${receiptsTodayCount} baixa${receiptsTodayCount > 1 ? "s" : ""} confirmada${receiptsTodayCount > 1 ? "s" : ""}`
          : "Nenhuma baixa registrada",
      icon: Wallet,
      status: receiptsToday > 0 ? "success" : "neutral",
    },
    {
      id: "below-min",
      label: "Estoque abaixo do mínimo",
      value: `${belowMin.length} produto${belowMin.length === 1 ? "" : "s"}`,
      hint: belowMin.length > 0 ? "Reabasteça para não perder venda" : "Estoque saudável",
      icon: PackageMinus,
      status: belowMin.length > 0 ? "warning" : "success",
    },
    {
      id: "stagnant",
      label: "Produtos parados",
      value: `${stagnant.length} produto${stagnant.length === 1 ? "" : "s"}`,
      hint: stagnant.length > 0 ? "Sem giro há 90 dias" : "Todo o catálogo com giro",
      icon: Package,
      status: stagnant.length > 0 ? "info" : "success",
    },
  ];

  const isLoading = salesMetrics.isLoading || finance.isLoading || inventory.isLoading;

  return (
    <ErrorBoundary
      fallbackRender={({ error }) => (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-8 text-center">
          <AlertTriangle className="mb-4 h-12 w-12 text-destructive" />
          <h2 className="text-xl font-bold">Erro ao carregar o dashboard</h2>
          <p className="mt-2 text-muted-foreground">Ocorreu uma falha na renderização de um componente. Nossa equipe foi notificada.</p>
          <pre className="mt-4 max-w-full overflow-auto rounded bg-muted p-4 text-left text-xs text-destructive">
            {String(error)}
          </pre>
          <Button className="mt-6" onClick={() => window.location.reload()}>
            Tentar novamente
          </Button>
        </div>
      )}
    >
      <div
        className={cn(
        "mx-auto w-full max-w-7xl p-4 sm:p-6",
        SPACING_TOKENS.relaxed.stack,
      )}
    >
      {/* 1 — EntityHeader */}
      <EntityHeader
        icon={BarChart3}
        title="Dashboard"
        description={`${timeGreeting()}, ${first}. Um resumo executivo do seu negócio agora.`}
        status={{ label: company.name, status: "info" }}
        actions={
          <ActionToolbar
            createLabel="Nova venda"
            onCreate={() => navigate({ to: ROUTES.sales })}
            moreActions={[
              { label: "Nova compra", icon: ShoppingBag, onSelect: () => navigate({ to: ROUTES.purchases }) },
              { label: "Novo produto", icon: Package, onSelect: () => navigate({ to: ROUTES.products }) },
              { label: "Novo cliente", icon: UserPlus, onSelect: () => navigate({ to: ROUTES.customers }) },
            ]}
      />

      {/* Filtro de Período */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-card p-4 rounded-lg border shadow-sm">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-4 w-4 text-muted-foreground" />
          <span className={cn("font-medium", TEXT_TOKENS.sm)}>Período:</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 flex-1">
          <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Selecione o período" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Hoje</SelectItem>
              <SelectItem value="yesterday">Ontem</SelectItem>
              <SelectItem value="7d">Últimos 7 dias</SelectItem>
              <SelectItem value="month">Este Mês</SelectItem>
              <SelectItem value="custom">Intervalo Personalizado</SelectItem>
            </SelectContent>
          </Select>

          {period === "custom" && (
            <DateRangePicker 
              value={customRange}
              onChange={setCustomRange}
              className="w-full sm:w-auto"
            />
          )}
        </div>
        
        <div className="hidden sm:block text-xs text-muted-foreground italic">
          Fuso horário: America/Sao_Paulo
        </div>
      </div>

        }
      />

      {/* 2 — Hero KPI: receita do período domina a tela */}
      <HeroMetric
        label={
          <div className="flex items-center gap-2">
            <span>
              Receita do período · {
                period === "today" ? "hoje" : 
                period === "yesterday" ? "ontem" : 
                period === "7d" ? "últimos 7 dias" : 
                period === "month" ? "este mês" : "personalizado"
              }
            </span>
            <button 
              onClick={() => setIsAuditOpen(true)}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-help"
              title="Ver detalhes do cálculo"
            >
              <HelpCircle className="h-3 w-3" />
            </button>
          </div>
        }
        value={formatCurrency(dayTotal)}
        caption={
          dayCount > 0
            ? `${dayCount} venda${dayCount > 1 ? "s" : ""} faturada${dayCount > 1 ? "s" : ""} no período selecionado.`
            : "Nenhuma venda faturada no período selecionado."
        }
        icon={DollarSign}
        status={dayTotal > 0 ? "success" : "neutral"}
        loading={salesMetrics.isLoading}
        side={
          <StatStack
            orientation="vertical"
            density="normal"
            loading={finance.isLoading}
            items={[
              { label: "Recebido hoje", value: formatCurrency(receiptsToday), icon: Wallet, status: "success" },
              { label: "Caixa disponível", value: formatCurrency(cash), icon: Wallet, status: "info" },
            ]}
          />
        }
      />

      {/* 3 — MetricGrid: Receita, Resultado a receber, Caixa, Alertas */}
      <MetricGrid columns={4} label="Indicadores principais">
        <MetricCard
          title="Receita hoje"
          value={formatCurrency(dayTotal)}
          icon={DollarSign}
          status="success"
          loading={salesMetrics.isLoading}
          footer={dayCount > 0 ? `${dayCount} venda${dayCount > 1 ? "s" : ""}` : "Sem vendas hoje"}
        />
        <MetricCard
          title="Dinheiro para entrar"
          value={formatCurrency(receivable)}
          icon={TrendingUp}
          status="info"
          loading={finance.isLoading}
          footer={
            receivableCount > 0
              ? `${receivableCount} título${receivableCount > 1 ? "s" : ""} em aberto`
              : "Nenhuma cobrança em aberto"
          }
        />
        <MetricCard
          title="Caixa disponível"
          value={formatCurrency(cash)}
          icon={Wallet}
          status="neutral"
          loading={finance.isLoading}
          footer="Saldo consolidado"
        />
        <MetricCard
          title="Alertas de estoque"
          value={String(belowMin.length)}
          icon={AlertTriangle}
          status={belowMin.length > 0 ? "warning" : "success"}
          loading={inventory.isLoading}
          footer={belowMin.length > 0 ? "Produtos abaixo do mínimo" : "Nenhum alerta de estoque"}
        />
      </MetricGrid>

      {/* 4 — Duas colunas: Resumo Executivo + Insights | Bella + Prioridades */}
      <div className={cn("grid items-start lg:grid-cols-2", SPACING_TOKENS.relaxed.gap)}>
        <div className={SPACING_TOKENS.relaxed.stack}>
          <Section
            title="Resumo executivo"
            description="Os números oficiais consolidados do dia."
            actions={
              <div className="flex items-center gap-2">
                <Switch
                  id="include-homologation"
                  checked={includeHomologation}
                  onCheckedChange={setIncludeHomologation}
                />
                <Label htmlFor="include-homologation" className={TEXT_TOKENS.xs}>
                  Incluir homologação
                </Label>
              </div>
            }
            footer={
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link to={ROUTES.reports}>
                    <LineChart className="mr-1.5 h-4 w-4" /> Relatórios
                  </Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to={ROUTES.executivePanel}>
                    <BarChart3 className="mr-1.5 h-4 w-4" /> Painel executivo
                  </Link>
                </Button>
              </div>
            }
          >
            <StatStack
              orientation="horizontal"
              loading={isLoading}
              items={[
                { label: "Faturamento", value: formatCurrency(dayTotal), status: "success" },
                { label: "A receber", value: formatCurrency(receivable), status: "info" },
                { label: "Caixa", value: formatCurrency(cash), status: "neutral" },
                { label: "Produtos", value: String(productCount), status: "neutral" },
              ]}
            />
          </Section>

          <Section title="Insights" description="Leitura rápida do que mudou.">
            <InsightCards items={insights} loading={isLoading} />
          </Section>
        </div>

        <div className={SPACING_TOKENS.relaxed.stack}>
          {/* Bella — mais destaque, menos bordas */}
          <BellaDailyBriefCard brief={bellaSnapshot.brief} />

          <Panel
            elevation="floating"
            className="border-primary/25 bg-gradient-to-br from-primary/10 via-card to-card"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <span
                  aria-hidden="true"
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary"
                >
                  <Sparkles className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className={cn("font-semibold", TEXT_TOKENS.base)}>Fale com a Bella</p>
                  <p className={cn("mt-1 text-muted-foreground", TEXT_TOKENS.sm)}>
                    Pergunte sobre vendas, caixa, impostos e estoque em linguagem natural.
                  </p>
                </div>
              </div>
              <Button size="sm" asChild className="shrink-0">
                <Link to={ROUTES.bella}>Abrir Bella</Link>
              </Button>
            </div>
          </Panel>

          {/* Prioridades — Action Center (lógica intacta) */}
          <ActionCenter companyId={company.id} />
        </div>
      </div>

      {/* 5 — Lista de interesse (potencial de vendas) */}
      <InterestDashboardCard companyId={company.id} />

      {/* 5 — Eventos inteligentes */}
      <Section
        title="Eventos inteligentes"
        description="Monitoramentos automáticos do NexOS."
        density="comfortable"
      >
        <div className={SPACING_TOKENS.comfortable.stack}>
          <CashClosingReminder companyId={company.id} operatorId={user.id} />
          <WhatsAppUsageCard companyId={company.id} />
        </div>
      </Section>

      {/* 6 — Atividade recente */}
      <Section
        title="Atividade recente"
        description="Movimentações registradas no dia de hoje."
        density="comfortable"
        actions={
          <StatusBadge status={dayCount + receiptsTodayCount > 0 ? "success" : "neutral"} withDot>
            {dayCount + receiptsTodayCount > 0 ? "Com movimento" : "Sem movimento"}
          </StatusBadge>
        }
      >
        <StatStack
          orientation="horizontal"
          density="normal"
          loading={isLoading}
          items={[
            {
              label: "Vendas faturadas",
              value: String(dayCount),
              hint: formatCurrency(dayTotal),
              icon: ShoppingCart,
              status: dayCount > 0 ? "success" : "neutral",
            },
            {
              label: "Baixas financeiras",
              value: String(receiptsTodayCount),
              hint: formatCurrency(receiptsToday),
              icon: Wallet,
              status: receiptsTodayCount > 0 ? "success" : "neutral",
            },
            {
              label: "Títulos em aberto",
              value: String(receivableCount),
              hint: formatCurrency(receivable),
              icon: TrendingUp,
              status: receivableCount > 0 ? "pending" : "neutral",
            },
          ]}
        />
      </Section>
      <RevenueAuditDialog 
        isOpen={isAuditOpen} 
        onOpenChange={setIsAuditOpen} 
        breakdown={breakdown}
        dayTotal={dayTotal}
      />
      </div>
    </ErrorBoundary>
  );
}
