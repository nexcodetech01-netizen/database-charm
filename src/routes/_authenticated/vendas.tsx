import { useMemo, useState } from "react";
import { useFinanceOverview } from "@/features/finance/hooks/use-finance";
import {
  PaymentReceiptDialog,
  type PaymentReceiptInfo,
} from "@/features/sales/components/payment-receipt-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { creditService } from "@/features/credit/services/credit.service";
import { ReceivePaymentDialog } from "@/features/credit/components/receive-payment-dialog";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Plus, ShoppingCart, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageLayout, KpiSection, KpiCard } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  SaleFilters,
  SaleTable,
  salesService,
  useDeleteSale,
  useSalesList,
  useSetSaleStatus,
  useSaleMetrics,
  useRestoreSale,
} from "@/features/sales";
import { SalesBellaHints } from "@/features/bella-ai";
import { BellaSalesPanel } from "@/features/accounting-ai/sales";
import type { SaleListFilters, SaleWithMeta } from "@/features/sales";
import { SettleTransactionDialog } from "@/features/finance/components/settle-transaction-dialog";
import type { FinancialTransaction } from "@/features/finance/types";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useNextAction } from "@/components/feedback/next-action-provider";
import {
  FISCAL_DELETE_BLOCKED_MESSAGE,
  isFiscalDeleteBlockedError,
} from "@/features/sales/lib/fiscal-delete-guard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBellaSales } from "@/features/accounting-ai/sales/use-bella-sales";
import { formatCurrency, formatNumber } from "@/lib/format";

/** Erro 23514 (check_violation) vindo do Postgres, direto ou em `cause`. */
function isCheckViolation(error: unknown): boolean {
  const code = (value: unknown) =>
    value && typeof value === "object" && "code" in value
      ? (value as { code?: unknown }).code
      : undefined;
  const cause = error instanceof Error ? error.cause : undefined;
  return code(error) === "23514" || code(cause) === "23514";
}

export const Route = createFileRoute("/_authenticated/vendas")({
  beforeLoad: requirePermission("sales.view"),
  component: SalesPage,
});

type RangeKey = "today" | "7d" | "month" | "30d";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
  { value: "today", label: "Hoje" },
  { value: "7d", label: "Últimos 7 dias" },
  { value: "month", label: "Mês atual" },
  { value: "30d", label: "Últimos 30 dias" },
];

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function resolveRange(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  const to = toISO(now);
  if (key === "today") return { from: to, to };
  if (key === "7d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 6);
    return { from: toISO(from), to };
  }
  if (key === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 29);
    return { from: toISO(from), to };
  }
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toISO(from), to };
}

const DEFAULT: SaleListFilters = {
  search: "",
  status: "",
  customerId: "",
  paymentMethod: "",
  paymentStatus: "",

  sortBy: "sale_date",
  sortDir: "desc",
  page: 1,
  pageSize: 20,
};

function SalesPage() {
  const { company } = Route.useRouteContext();
  const [filters, setFilters] = useState<SaleListFilters>(DEFAULT);
  const [rangeKey, setRangeKey] = useState<RangeKey>("month");


  const range = useMemo(() => resolveRange(rangeKey), [rangeKey]);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
  
  const { data, isLoading } = useSalesList(company.id, effective);
  const metrics = useSaleMetrics(company.id, range, undefined, rangeKey === "today" ? "today" : undefined);
  // "A receber" de verdade: mesma conta do Financeiro (títulos + crediário).
  const overview = useFinanceOverview(company.id);
  const { view, isLoading: bellaLoading } = useBellaSales(company.id);


  const setStatusMut = useSetSaleStatus();
  const deleteMut = useDeleteSale();
  const restoreMut = useRestoreSale();
  const showNextAction = useNextAction();

  const [settleSale, setSettleSale] = useState<SaleWithMeta | null>(null);
  const [settleTx, setSettleTx] = useState<FinancialTransaction | null>(null);
  const [creditReceive, setCreditReceive] = useState<{
    sale: SaleWithMeta;
    accountId: string;
    balance: number;
  } | null>(null);
  const qc = useQueryClient();
  const [receipt, setReceipt] = useState<PaymentReceiptInfo | null>(null);

  const hasAlerts = view.alerts.length > 0;

    async function handleMarkPaid(s: SaleWithMeta) {
    try {
      // Crediário: o saldo é controlado pela conta de crediário (parcelas).
      // Antes ia para a baixa genérica do Financeiro, que não abatia o
      // crediário e terminava marcando a venda como paga.
      const creditAccount = await creditService.getAccountBySale(s.id);
      if (creditAccount && creditAccount.status !== "settled" && creditAccount.status !== "cancelled") {
        setCreditReceive({
          sale: s,
          accountId: creditAccount.id,
          balance: Number(creditAccount.balance) || 0,
        });
        return;
      }

      const tx = await salesService.openReceivableForSale(s.id);
      if (!tx) {
        toast.error("Não foi possível localizar o título financeiro", {
          description: "O lançamento pode ter sido removido ou já estar baixado.",
        });
        return;
      }
      setSettleSale(s);
      setSettleTx(tx);
    } catch (e) {
      toast.error("Não foi possível abrir a baixa financeira", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

    /**
   * Depois da baixa, o próprio banco define o status da venda: "paga" se
   * quitou, "parcialmente paga" se foi baixa parcial.
   * BUG CORRIGIDO (2026-10-07): aqui se forçava "paga" sempre — uma baixa
   * parcial virava venda paga, com o saldo restante ainda em aberto.
   */
  /**
   * Depois de uma baixa (ou pagamento de crediário): mostra o comprovante
   * para imprimir/mandar no WhatsApp. O status da venda é calculado pelo
   * banco a partir do dinheiro. (Antes aparecia "Cliente recorrente", que é
   * a tela de venda nova.)
   */
  async function finishSaleSettled(
    s: SaleWithMeta,
    paid?: { amount?: number; paymentMethod?: string; paidAt?: string },
  ) {
    await qc.invalidateQueries({ queryKey: ["sales"] });
    if (paid?.amount && paid.amount > 0) {
      setReceipt({
        saleId: s.id,
        receivedAmount: paid.amount,
        paymentMethod: paid.paymentMethod ?? null,
        paidAt: paid.paidAt ?? null,
      });
    }
  }

  function showPaidNextAction(s: SaleWithMeta) {
    const isRecurringCustomer =
      !!s.customer_id &&
      (data?.rows ?? []).some(
        (r) => r.customer_id === s.customer_id && r.id !== s.id,
      );

    if (isRecurringCustomer && s.customer_id) {
      showNextAction({
        title: "🎉 Cliente recorrente",
        summary: ["Compra registrada", "Histórico atualizado"],
        question: "Este cliente voltou a comprar. O que deseja fazer?",
        primaryAction: {
          label: "Ver cliente",
          to: "/clientes/$customerId",
          params: { customerId: s.customer_id },
        },
        secondaryActions: [{ label: "Nova venda", to: "/vendas/novo" }],
      });
    } else {
      showNextAction({
        title: `Venda ${s.number} concluída`,
        summary: [
          "Venda concluída",
          "Estoque atualizado",
          "Financeiro atualizado",
          "Caixa atualizado",
          "Cupom pronto",
        ],
        question: "O que deseja fazer agora?",
        primaryAction: {
          label: "Imprimir cupom",
          to: "/vendas/$saleId",
          params: { saleId: s.id },
          search: { print: 1 } as Record<string, unknown>,
        },
        secondaryActions: [
          { label: "Nova venda", to: "/vendas/novo" },
          ...(s.customer_id
            ? [
                {
                  label: "Ver cliente",
                  to: "/clientes/$customerId",
                  params: { customerId: s.customer_id },
                } as const,
              ]
            : []),
        ],
      });
    }
  }

  async function handleStatus(s: SaleWithMeta, status: string, label: string) {
    try {
      await setStatusMut.mutateAsync({ id: s.id, status });
      toast.success(`Venda ${s.number} ${label}`);
    } catch (e) {
      toast.error("Não foi possível atualizar o status", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function handleDelete(s: SaleWithMeta) {
    try {
      await deleteMut.mutateAsync(s.id);
      toast.success("Venda excluída", {
        description: "O registro foi movido para a lixeira.",
        action: {
          label: "Desfazer",
          onClick: async () => {
            try {
              await restoreMut.mutateAsync(s.id);
              toast.success("Venda restaurada com sucesso!");
            } catch (err) {
              toast.error("Erro ao restaurar venda.");
            }
          },
        },
      });
    } catch (e) {
      if (isFiscalDeleteBlockedError(e)) {
        toast.error(FISCAL_DELETE_BLOCKED_MESSAGE, {
          description:
            "Use 'Cancelar venda' e, se necessário, cancele a NF-e pelo módulo fiscal.",
        });
        return;
      }
      // trg_guard_sale_soft_delete: venda com pagamento, caixa ou crediário.
      if (isCheckViolation(e) && s.status !== "cancelled") {
        toast.error("Esta venda não pode ser excluída", {
          description: e instanceof Error ? e.message : undefined,
          action: {
            label: "Cancelar venda",
            onClick: () => void handleStatus(s, "cancelled", "cancelada"),
          },
        });
        return;
      }
      toast.error("Não foi possível excluir", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  function handleSort(key: any) {
    setFilters(prev => ({
      ...prev,
      sortBy: key,
      sortDir: prev.sortBy === key && prev.sortDir === "desc" ? "asc" : "desc",
      page: 1
    }));
  }

  return (
    <PageLayout
      icon={ShoppingCart}
      title="Vendas"
      meta={`${metrics.data ? formatNumber(metrics.data.monthCount) : 0} pedidos no mês`}
      actions={
        <div className="flex items-center gap-3">
          <Select
            value={rangeKey}
            onValueChange={(v) => setRangeKey(v as RangeKey)}
          >
            <SelectTrigger className="h-9 w-[180px] rounded-xl text-sm bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RANGE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" asChild className="rounded-xl">
            <Link to="/vendas/novo">
              <Plus className="mr-1.5 h-4 w-4" /> Novo
            </Link>
          </Button>
        </div>
      }
      kpis={null}
    >
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-8 border-b border-border bg-transparent w-full justify-start rounded-none h-auto p-0 gap-8">
          <TabsTrigger 
            value="list"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-0 text-sm font-medium"
          >
            Visão Geral
          </TabsTrigger>
          <TabsTrigger 
            value="insights"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-0 text-sm font-medium"
          >
            Insights & IA
            {hasAlerts && (
              <span className="ml-2 h-2 w-2 rounded-full bg-warning animate-pulse" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4 border-none p-0 outline-none">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold tracking-tight text-muted-foreground">Histórico Operacional</h2>
            <SaleFilters
              companyId={company.id}
              filters={filters}
              onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
              onReset={() => setFilters(DEFAULT)}
            />
          </div>
          
          <SaleTable
            rows={data?.rows ?? []}
            total={data?.total ?? 0}
            isLoading={isLoading}
            page={filters.page}
            pageSize={filters.pageSize}
            onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            onMarkPending={(s) => handleStatus(s, "pending", "marcada como pendente")}
            onMarkPaid={handleMarkPaid}
            onCancel={(s) => handleStatus(s, "cancelled", "cancelada")}
            onDelete={handleDelete}
            onSort={handleSort}
          />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6 border-none p-0 outline-none">
          <KpiSection>
            <KpiCard
              label="Vendas do dia"
              value={metrics.data ? formatCurrency(metrics.data.dayTotal) : "—"}
              hint={metrics.data ? `${formatNumber(metrics.data.dayCount)} pedidos` : undefined}
              loading={metrics.isLoading}
            />
            <KpiCard
              label="Faturamento"
              value={metrics.data ? formatCurrency(metrics.data.monthTotal) : "—"}
              hint={metrics.data ? `${formatNumber(metrics.data.monthCount)} pedidos` : undefined}
              loading={metrics.isLoading}
              highlight
            />
            <KpiCard
              label="Ticket médio"
              value={metrics.data ? formatCurrency(metrics.data.averageTicket) : "—"}
              loading={metrics.isLoading}
            />
            {/* Antes este card se chamava "A Receber", mas somava as vendas PAGAS. */}
            <KpiCard
              label="Recebido"
              value={metrics.data ? formatCurrency(metrics.data.paidTotal) : "—"}
              hint="Vendas pagas no período"
              loading={metrics.isLoading}
            />
            <KpiCard
              label="A receber"
              value={overview.data?.receivableSales != null ? formatCurrency(overview.data.receivableSales) : "—"}
              hint={
                overview.data?.receivableCredit
                  ? `inclui ${formatCurrency(overview.data.receivableCredit)} de crediário`
                  : "Tudo que falta receber das vendas"
              }
              loading={overview.isLoading}
            />
          </KpiSection>
          {hasAlerts && (
            <div className="rounded-2xl border border-warning/20 bg-warning/5 p-4">
              <div className="mb-4 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold text-warning">Alertas Críticos ({view.alerts.length})</span>
              </div>
              <BellaSalesPanel companyId={company.id} className="border-0 bg-transparent p-0 shadow-none" hideHeader hideSummary hideRecommendations hideActions />
            </div>
          )}
          
          <SalesBellaHints companyId={company.id} />
          <BellaSalesPanel companyId={company.id} className="border-none shadow-none bg-accent/5" hideAlerts />
        </TabsContent>
      </Tabs>


      <SettleTransactionDialog
        open={!!settleSale && !!settleTx}
        onOpenChange={(open) => {
          if (!open) {
            setSettleSale(null);
            setSettleTx(null);
          }
        }}
        companyId={company.id}
        transaction={settleTx}
        verb="Receber"
        onSettled={(info) => {
          const s = settleSale;
          setSettleSale(null);
          setSettleTx(null);
          if (s) void finishSaleSettled(s, info);
        }}
            />
      {creditReceive ? (
        <ReceivePaymentDialog
          open
          onOpenChange={(open) => {
            if (!open) setCreditReceive(null);
          }}
          companyId={company.id}
          creditAccountId={creditReceive.accountId}
          balance={creditReceive.balance}
          saleId={creditReceive.sale.id}
          customerId={creditReceive.sale.customer_id}
          onPaid={(r) => {
            const s = creditReceive.sale;
            setCreditReceive(null);
            void finishSaleSettled(s, r);
          }}
        />
      ) : null}
      <PaymentReceiptDialog
        open={!!receipt}
        onOpenChange={(o) => !o && setReceipt(null)}
        companyId={company.id}
        info={receipt}
      />
    </PageLayout>
  );
}

