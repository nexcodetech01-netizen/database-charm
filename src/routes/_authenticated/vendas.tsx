import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Plus, ShoppingCart } from "lucide-react";
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


export const Route = createFileRoute("/_authenticated/vendas")({
  beforeLoad: requirePermission("sales.view"),
  component: SalesPage,
});

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
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
  const { data, isLoading } = useSalesList(company.id, effective);

  const setStatusMut = useSetSaleStatus();
  const deleteMut = useDeleteSale();
  const showNextAction = useNextAction();

  // FIN-BAIXA — "Marcar paga" reutiliza o fluxo de baixa do módulo Financeiro.
  const [settleSale, setSettleSale] = useState<SaleWithMeta | null>(null);
  const [settleTx, setSettleTx] = useState<FinancialTransaction | null>(null);

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


        // WOW 8 — cliente recorrente: detectar apenas com dados já carregados
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
      description="Como receber? Registre a venda e o NexOS cuida do estoque e do financeiro."
      actions={
        <Button size="sm" asChild>
          <Link to="/vendas/novo">
            <Plus className="mr-1.5 h-4 w-4" /> Nova venda
          </Link>
        </Button>
      }
      kpis={<SaleMetrics companyId={company.id} />}
    >
      <BellaSalesPanel companyId={company.id} />

      <SalesBellaHints companyId={company.id} />

      <SaleFilters
        companyId={company.id}
        filters={filters}
        onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        onReset={() => setFilters(DEFAULT)}
      />

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
