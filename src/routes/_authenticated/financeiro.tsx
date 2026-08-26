import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import {
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  LineChart,
  Plus,
  Minus,
  ArrowLeftRight,
  CheckCircle2,
  Download,
  Landmark,
  Zap,
  QrCode,
  CreditCard,
  Link2,
  Scale,
  ArrowDownRight,
  ArrowUpRight,
  FileBarChart,
  FileText,
  Sparkles,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettlementCleanupPanel } from "@/features/finance/components/settlement-cleanup-panel";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PageLayout, KpiSection, KpiCard } from "@/components/layout";
import {
  FinanceSummaryPanel,
  ReceivablesPayablesPanel,
  ReconciliationPanel,
  CashFlowPanel,
  TransactionsPanel,
  AccountsPanel,
  CategoriesPanel,
  GuidedTransactionDialog,
  TransactionFormDialog,
  useFinanceOverview,
  useAccounts,
} from "@/features/finance";
import { FinanceBellaHints } from "@/features/bella-ai";
import { BellaFinancePanel } from "@/features/accounting-ai/finance";
import type { TransactionType } from "@/features/finance";
import { formatCurrency } from "@/lib/format";


const FINANCE_TABS = [
  "summary",
  "receivables",
  "payables",
  "reconciliation",
  "cashflow",
  "categories",
  "accounts",
  "cleanup",
  "reports",
  "insights",
] as const;

type FinanceTab = (typeof FINANCE_TABS)[number];

export const Route = createFileRoute("/_authenticated/financeiro")({
  beforeLoad: requirePermission("finance.view"),
  validateSearch: (search: Record<string, unknown>): { tab?: FinanceTab } => {
    const raw = typeof search.tab === "string" ? search.tab : undefined;
    return {
      tab: (FINANCE_TABS as readonly string[]).includes(raw ?? "")
        ? (raw as FinanceTab)
        : undefined,
    };
  },
  component: FinancePage,
});

function FinancePage() {
  const { company } = Route.useRouteContext();
  const { tab: initialTab } = Route.useSearch();
  const { data, isLoading } = useFinanceOverview(company.id);
  const { data: accounts } = useAccounts(company.id);
  const [txOpen, setTxOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [txType, setTxType] = useState<TransactionType>("income");
  const [tab, setTab] = useState<FinanceTab>(initialTab ?? "summary");

  const realAvailableCash = (accounts || [])
    .filter((a: any) => a?.status === 'active')
    .reduce((acc: number, curr: any) => acc + (Number(curr?.current_balance) || 0), 0);

  const cashFlow = data ? (data.receivable || 0) - (data.payable || 0) : undefined;
  const monthResult = data ? (data.monthIncome || 0) - (data.monthExpense || 0) : undefined;

  function openTx(type: TransactionType) {
    setTxType(type);
    setTxOpen(true);
  }

  const actions = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => setTxOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" /> Nova Movimentação
        </Button>
      </div>
      <Separator orientation="vertical" className="hidden h-6 sm:block" />
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => setTransferOpen(true)}>
          <ArrowLeftRight className="mr-1.5 h-4 w-4" /> Transferência
        </Button>
        <Button size="sm" variant="ghost" disabled title="Em breve">
          <Download className="mr-1.5 h-4 w-4" /> Exportar
        </Button>
      </div>
    </div>
  );

  const kpis = (
    <KpiSection>
      <KpiCard
        label="Caixa Disponível"
        value={formatCurrency(realAvailableCash)}
        icon={Wallet}
        highlight
        hint="Soma dos saldos das contas ativas"
        loading={isLoading}
        onClick={() => setTab("accounts")}
      />
      <KpiCard
        label="A receber"
        value={data ? formatCurrency(data.receivable) : "—"}
        icon={ArrowDownRight}
        loading={isLoading}
        onClick={() => setTab("receivables")}
      />
      <KpiCard
        label="A pagar"
        value={data ? formatCurrency(data.payable) : "—"}
        icon={ArrowUpRight}
        loading={isLoading}
        onClick={() => setTab("payables")}
      />
      <KpiCard
        label="Resultado do mês"
        value={monthResult !== undefined ? formatCurrency(monthResult) : "—"}
        icon={Scale}
        highlight
        hint={
          monthResult !== undefined
            ? monthResult >= 0
              ? "Superávit no período"
              : "Déficit no período"
            : undefined
        }
        loading={isLoading}
        onClick={() => setTab("cashflow")}
      />
    </KpiSection>

  );

  const tabTriggerClass =
    "transition-all data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm";

  return (
    <PageLayout
      title="Financeiro"
      meta={data ? `Resultado: ${formatCurrency(monthResult ?? 0)}` : "Carregando..."}
      actions={actions}
      kpis={kpis}
    >

      <Tabs
        value={tab}
        onValueChange={(v) => setTab(v as FinanceTab)}
        className="space-y-8 pt-2"
      >
        <TabsList className="mb-8 border-b border-border bg-transparent w-full justify-start rounded-none h-auto p-0 gap-8 overflow-x-auto no-scrollbar">
          <TabsTrigger 
            value="summary" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-0 text-sm font-semibold whitespace-nowrap gap-2"
          >
            <LineChart className="h-4 w-4" /> Resumo
          </TabsTrigger>
          <TabsTrigger 
            value="receivables" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-0 text-sm font-semibold whitespace-nowrap gap-2"
          >
            <ArrowDownRight className="h-4 w-4" /> A Receber
          </TabsTrigger>
          <TabsTrigger 
            value="payables" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-0 text-sm font-semibold whitespace-nowrap gap-2"
          >
            <ArrowUpRight className="h-4 w-4" /> A Pagar
          </TabsTrigger>
          <TabsTrigger 
            value="cashflow" 
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-0 text-sm font-semibold whitespace-nowrap gap-2"
          >
            <FileText className="h-4 w-4" /> Extrato de Movimentações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="space-y-8">
          <FinanceSummaryPanel companyId={company.id} />
          <BellaPayCard />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          <FinanceBellaHints companyId={company.id} />
          <BellaFinancePanel companyId={company.id} />
        </TabsContent>

        <TabsContent value="receivables" className="space-y-8">
          <ReceivablesPayablesPanel companyId={company.id} kind="receivable" />
        </TabsContent>

        <TabsContent value="payables" className="space-y-8">
          <ReceivablesPayablesPanel companyId={company.id} kind="payable" />
        </TabsContent>

        <TabsContent value="cashflow" className="space-y-6">
          <TransactionsPanel companyId={company.id} />
        </TabsContent>
      </Tabs>

      <GuidedTransactionDialog
        open={txOpen}
        onOpenChange={setTxOpen}
        companyId={company.id}
      />

      <TransactionFormDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        companyId={company.id}
        defaultType="transfer"
      />
    </PageLayout>
  );
}


function ReportsComingSoon() {
  const items = [
    "DRE",
    "Fluxo de Caixa",
    "Contas a Receber",
    "Contas a Pagar",
    "Exportações",
  ];
  return (
    <Card className="overflow-hidden border-dashed">
      <CardContent className="grid gap-8 p-8 md:grid-cols-[auto_1fr] md:items-center">
        <div className="relative mx-auto grid h-32 w-32 place-items-center">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative grid h-24 w-24 place-items-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 text-primary shadow-inner">
            <FileBarChart className="h-10 w-10" />
          </div>
          <span className="absolute -right-1 -top-1 grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground shadow">
            <Sparkles className="h-4 w-4" />
          </span>
        </div>
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <LineChart className="h-5 w-5 text-primary" />
              Relatórios Financeiros
            </h3>
            <p className="text-sm text-muted-foreground">
              Em breve estarão disponíveis nesta central:
            </p>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {items.map((it) => (
              <li
                key={it}
                className="flex items-center gap-2 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/30 hover:bg-primary/5"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {it}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            Estamos preparando painéis exportáveis com filtros por período,
            categoria e conta.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}


function BellaPayCard() {
  const channels = [
    { label: "PIX", icon: QrCode },
    { label: "Cartão", icon: CreditCard },
    { label: "Link de pagamento", icon: Link2 },
    { label: "Conciliação", icon: CheckCircle2 },
  ];
  return (
    <Card className="border-primary/30 bg-primary/5 transition-shadow hover:shadow-md">
      <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Zap className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-semibold">Bella Pay</h3>
              <span className="rounded-md bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                Integrado
              </span>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Cobre com PIX, cartão e links de pagamento. Conciliação
              automática das transações.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {channels.map((c) => {
            const Icon = c.icon;
            return (
              <span
                key={c.label}
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground"
              >
                <Icon className="h-3.5 w-3.5 text-primary" />
                {c.label}
              </span>
            );
          })}
          <Button asChild size="sm" variant="outline">
            <a href="/bella-pay">
              <Landmark className="mr-1.5 h-4 w-4" /> Abrir Bella Pay
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
