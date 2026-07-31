import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  DollarSign,
  LineChart,
  Package,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  UserPlus,
  Wallet,
} from "lucide-react";
import { PageLayout, KpiSection, KpiCard } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/config/routes";
import { ActionCenter } from "@/features/dashboard/components/action-center";
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

function DashboardPage() {
  const { user, company } = Route.useRouteContext();
  const first =
    ((user.user_metadata?.full_name as string | undefined) ||
      user.email?.split("@")[0] ||
      "por aí")
      .split(" ")[0];

  const [showNumbers, setShowNumbers] = useState(false);
  // Isolamento de homologação: por padrão os indicadores ignoram vendas de teste.
  const [includeHomologation, setIncludeHomologation] = useState(false);

  const salesMetrics = useSaleMetrics(
    company.id,
    undefined,
    includeHomologation ? "all" : "production",
  );
  const inventory = useInventoryMetrics(company.id);
  const finance = useFinanceOverview(company.id);

  // PWA / mobile: força refetch ao abrir e ao voltar ao primeiro plano.
  useMobileDashboardRefresh([
    salesKeys.metrics(company.id),
    inventoryKeys.metrics(company.id),
    financeKeys.overview(company.id),
  ]);

  // Faturamento hoje — vendas status='paid' com sale_date = company_today().
  const dayTotal = salesMetrics.data?.dayTotal ?? 0;
  const dayCount = salesMetrics.data?.dayCount ?? 0;
  // Caixa disponível — fonte oficial: soma de financial_accounts ativas.
  const cash = finance.data?.currentBalance ?? 0;
  // Recebimentos ≠ faturamento: baixas efetivadas hoje (paid_at no dia da empresa).
  const receiptsToday = finance.data?.receiptsToday ?? 0;
  const receiptsTodayCount = finance.data?.receiptsTodayCount ?? 0;

  // Dinheiro para entrar — financial_transactions de receita com status='pending'.
  const receivable = finance.data?.pendingReceivable ?? 0;
  const receivableCount = finance.data?.pendingReceivableCount ?? 0;



  return (
    <PageLayout
      icon={BarChart3}
      title="Dashboard"
      description="O que preciso resolver hoje?"
      meta={
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{company.name}</span>
          <Badge variant="outline" className="text-xs">
            {timeGreeting()}, {first}
          </Badge>
        </div>
      }
      actions={
        <Button size="sm" asChild className="gap-1.5">
          <Link to={ROUTES.sales}>
            <ShoppingCart className="h-4 w-4" /> Nova venda
          </Link>
        </Button>
      }
    >
      {/* Lembrete de fechamento de caixa (a partir das 19:15) */}
      <CashClosingReminder companyId={company.id} operatorId={user.id} />

      {/* CENTRAL DE AÇÕES — o coração do NexOS 3.0 */}
      <ActionCenter companyId={company.id} />

      {/* Atalhos essenciais — 1 clique para o que mais importa */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Começar rápido</CardTitle>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Os quatro caminhos que todo dia importam.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Shortcut to={ROUTES.sales} icon={ShoppingCart} label="Vender" />
            <Shortcut to={ROUTES.purchases} icon={ShoppingBag} label="Comprar" />
            <Shortcut to={ROUTES.products} icon={Package} label="Produto" />
            <Shortcut to={ROUTES.customers} icon={UserPlus} label="Cliente" />
          </div>
        </CardContent>
      </Card>

      {/* Monitoramento de mensagens WhatsApp */}
      <WhatsAppUsageCard companyId={company.id} />

      {/* Bella em destaque */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-primary/15 text-primary">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">Fale com a Bella</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                "Como estão minhas vendas hoje?", "Quais produtos estão parados?"
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <Link to={ROUTES.bella}>Abrir Bella</Link>
          </Button>
        </CardContent>
      </Card>

      {/* Números do dia — colapsável, secundário */}
      <Card>
        <CardHeader
          className="flex flex-row items-center justify-between space-y-0 pb-3 cursor-pointer"
          onClick={() => setShowNumbers((v) => !v)}
        >
          <div>
            <CardTitle className="text-base">Ver números do dia</CardTitle>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Faturamento, caixa e estoque em tempo real.
            </p>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5">
            {showNumbers ? (
              <>
                Ocultar <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                Mostrar <ChevronDown className="h-4 w-4" />
              </>
            )}
          </Button>
        </CardHeader>
        {showNumbers && (
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch
                id="include-homologation"
                checked={includeHomologation}
                onCheckedChange={setIncludeHomologation}
              />
              <Label htmlFor="include-homologation" className="text-xs">
                Incluir dados de homologação
              </Label>
            </div>
            <KpiSection columns={4}>
              <KpiCard
                label="Faturamento hoje"
                value={formatCurrency(dayTotal)}
                icon={DollarSign}
                hint={dayCount > 0 ? `${dayCount} venda${dayCount > 1 ? "s" : ""}` : "Sem vendas hoje"}
              />
              <KpiCard
                label="Recebimentos hoje"
                value={formatCurrency(receiptsToday)}
                icon={Wallet}
                hint={
                  receiptsTodayCount > 0
                    ? `${receiptsTodayCount} baixa${receiptsTodayCount > 1 ? "s" : ""} hoje`
                    : "Nenhum recebimento hoje"
                }
              />

              <KpiCard
                label="Dinheiro para entrar"
                value={formatCurrency(receivable)}
                icon={TrendingUp}
                hint={
                  receivableCount > 0
                    ? `${receivableCount} título${receivableCount > 1 ? "s" : ""} em aberto`
                    : "Nenhuma cobrança em aberto"
                }
              />
              <KpiCard
                label="Caixa disponível"
                value={formatCurrency(cash)}
                icon={Wallet}
                hint="Saldo consolidado"
              />
              <KpiCard
                label="Produtos"
                value={String(inventory.data?.productCount ?? 0)}
                icon={Package}
                hint={`${inventory.data?.belowMin.length ?? 0} abaixo do mínimo`}
              />
            </KpiSection>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              <MiniPanel
                title="Ver relatórios completos"
                description="Análise de vendas, financeiro e estoque."
                to={ROUTES.reports}
                icon={LineChart}
              />
              <MiniPanel
                title="Painel executivo"
                description="KPIs consolidados para tomada de decisão."
                to={ROUTES.executivePanel}
                icon={BarChart3}
              />
            </div>
          </CardContent>
        )}
      </Card>
    </PageLayout>
  );
}

function Shortcut({
  to,
  icon: Icon,
  label,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-2 rounded-lg border border-border bg-card p-4 text-center transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <span className="text-sm font-medium leading-tight">{label}</span>
    </Link>
  );
}

function MiniPanel({
  title,
  description,
  to,
  icon: Icon,
}: {
  title: string;
  description: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent"
    >
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
