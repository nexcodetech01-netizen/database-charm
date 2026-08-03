import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Plus, ShoppingCart, ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageLayout } from "@/components/layout";
import {
  SaleFilters,
  SaleMetrics,
  SaleTable,
  salesService,
  useDeleteSale,
  useSalesList,
  useSetSaleStatus,
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useBellaSales } from "@/features/accounting-ai/sales/use-bella-sales";

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
  const [alertsOpen, setAlertsOpen] = useState(true);
  const [bellaOpen, setBellaOpen] = useState(false);

  const range = useMemo(() => resolveRange(rangeKey), [rangeKey]);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
  
  const { data, isLoading } = useSalesList(company.id, effective);
  const { view, isLoading: bellaLoading } = useBellaSales(company.id);

  const setStatusMut = useSetSaleStatus();
  const deleteMut = useDeleteSale();
  const showNextAction = useNextAction();

  const [settleSale, setSettleSale] = useState<SaleWithMeta | null>(null);
  const [settleTx, setSettleTx] = useState<FinancialTransaction | null>(null);

  const hasAlerts = view.alerts.length > 0;

  async function handleMarkPaid(s: SaleWithMeta) {
    try {
      const tx = await salesService.openReceivableForSale(s.id);
      if (!tx) {
        toast.error("Não há lançamento financeiro em aberto para esta venda", {
          description:
            "A baixa deve ser registrada pelo módulo Financeiro para esta venda.",
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

  async function finishSalePaid(s: SaleWithMeta) {
    try {
      await setStatusMut.mutateAsync({ id: s.id, status: "paid" });
      showPaidNextAction(s);
    } catch (e) {
      toast.error("Baixa registrada, mas o status da venda não foi atualizado", {
        description: e instanceof Error ? e.message : undefined,
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
    if (s.status === "paid" || s.status === "cancelled") {
      toast.error("Não é possível excluir esta venda", {
        description:
          "Vendas finalizadas não podem ser excluídas. Utilize a opção 'Cancelar venda' para reverter estoque e manter o histórico.",
      });
      return;
    }
    if (!confirm(`Excluir permanentemente a venda "${s.number}"?`)) return;
    try {
      await deleteMut.mutateAsync(s.id);
      toast.success("Venda excluída");
    } catch (e) {
      if (isFiscalDeleteBlockedError(e)) {
        toast.error(FISCAL_DELETE_BLOCKED_MESSAGE, {
          description:
            "Use 'Cancelar venda' e, se necessário, cancele a NF-e pelo módulo fiscal.",
        });
        return;
      }
      toast.error("Não foi possível excluir", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <PageLayout
      icon={ShoppingCart}
      title="Vendas"
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
              <Plus className="mr-1.5 h-4 w-4" /> Nova venda
            </Link>
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <SaleMetrics companyId={company.id} range={range} />

        {hasAlerts && (
          <Collapsible
            open={alertsOpen}
            onOpenChange={setAlertsOpen}
            className="rounded-2xl border border-warning/20 bg-warning/5 overflow-hidden"
          >
            <CollapsibleTrigger asChild>
              <button className="flex w-full items-center justify-between p-4 hover:bg-warning/10 transition-colors">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <span className="text-sm font-semibold text-warning">Necessita Atenção</span>
                  <span className="rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning">
                    {view.alerts.length}
                  </span>
                </div>
                {alertsOpen ? <ChevronUp className="h-4 w-4 text-warning" /> : <ChevronDown className="h-4 w-4 text-warning" />}
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4">
                <BellaSalesPanel companyId={company.id} className="border-0 bg-transparent p-0 shadow-none" hideHeader hideSummary hideRecommendations hideActions />
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Histórico de Vendas</h2>
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
          />
        </div>

        <Collapsible
          open={bellaOpen}
          onOpenChange={setBellaOpen}
          className="rounded-2xl border border-border/70 bg-card overflow-hidden"
        >
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between p-4 hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2">
                <ShoppingCart className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">Bella Vendas</span>
              </div>
              {bellaOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="p-4 pt-0">
              <BellaSalesPanel companyId={company.id} className="border-0 bg-transparent shadow-none" hideAlerts />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>

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
        onSettled={() => {
          const s = settleSale;
          setSettleSale(null);
          setSettleTx(null);
          if (s) void finishSalePaid(s);
        }}
      />
    </PageLayout>
  );
}

