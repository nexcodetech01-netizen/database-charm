import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageLayout, KpiSection, KpiCard } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  PurchaseFilters,
  PurchaseMetrics,
  PurchaseTable,
  useDeletePurchase,
  usePurchasesList,
  useSetPurchaseStatus,
  usePurchaseMetrics,
} from "@/features/purchases";
import { PurchasesBellaHints } from "@/features/bella-ai";
import { BellaPurchasesPanel } from "@/features/accounting-ai/purchases";
import type { PurchaseListFilters, PurchaseWithMeta } from "@/features/purchases";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useNextAction } from "@/components/feedback/next-action-provider";

export const Route = createFileRoute("/_authenticated/compras")({
  beforeLoad: requirePermission("purchases.view"),
  component: PurchasesPage,
});

const DEFAULT: PurchaseListFilters = {
  search: "",
  status: "",
  supplierId: "",
  sortBy: "purchase_date",
  sortDir: "desc",
  page: 1,
  pageSize: 20,
};

function PurchasesPage() {
  const { company } = Route.useRouteContext();
  const [filters, setFilters] = useState<PurchaseListFilters>(DEFAULT);
  const debouncedSearch = useDebouncedValue(filters.search, 300);
  const effective = useMemo(
    () => ({ ...filters, search: debouncedSearch }),
    [filters, debouncedSearch],
  );
  const { data, isLoading } = usePurchasesList(company.id, effective);
  const metrics = usePurchaseMetrics(company.id);

  const setStatusMut = useSetPurchaseStatus();
  const deleteMut = useDeletePurchase();
  const showNextAction = useNextAction();

  async function handleStatus(p: PurchaseWithMeta, status: string, label: string) {
    try {
      await setStatusMut.mutateAsync({ id: p.id, status });
      if (status === "received") {
        showNextAction({
          title: `Compra ${p.number} registrada`,
          summary: [
            "Compra registrada",
            "Estoque atualizado",
            "Custos atualizados",
            "Preços recalculados",
          ],
          question: "O que deseja fazer agora?",
          primaryAction: { label: "Conferir preços", to: "/produtos" },
          secondaryActions: [
            { label: "Nova compra", to: "/compras/novo" },
          ],
        });
      } else {
        toast.success(`Compra ${p.number} ${label}`);
      }
    } catch (e) {
      toast.error("Não foi possível atualizar o status", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  async function handleDelete(p: PurchaseWithMeta) {
    if (!confirm(`Excluir permanentemente a compra "${p.number}"?`)) return;
    try {
      await deleteMut.mutateAsync(p.id);
      toast.success("Compra excluída");
    } catch (e) {
      toast.error("Não foi possível excluir", {
        description: e instanceof Error ? e.message : undefined,
      });
    }
  }

  return (
    <PageLayout
      icon={ShoppingBag}
      title="Compras"
      description="Gestão de entradas e controle de custos de aquisição."
      actions={
        <Button size="sm" asChild>
          <Link to="/compras/novo">
            <Plus className="mr-1.5 h-4 w-4" /> Nova compra
          </Link>
        </Button>
      }
      kpis={
        <KpiSection>
          <KpiCard
            label="Compras do mês"
            value={metrics.data ? formatNumber(metrics.data.monthCount) : "—"}
            loading={metrics.isLoading}
          />
          <KpiCard
            label="Total comprado"
            value={metrics.data ? formatCurrency(metrics.data.monthTotal) : "—"}
            loading={metrics.isLoading}
            highlight
          />
          <KpiCard
            label="Pedidos pendentes"
            value={metrics.data ? formatNumber(metrics.data.pending) : "—"}
            loading={metrics.isLoading}
          />
          <KpiCard
            label="Fornecedores ativos"
            value={metrics.data ? formatNumber(metrics.data.activeSuppliers) : "—"}
            loading={metrics.isLoading}
          />
        </KpiSection>
      }
    >
      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list">Lista de Compras</TabsTrigger>
          <TabsTrigger value="insights">Insights & IA Bella</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4 border-none p-0 outline-none">
          <PurchaseFilters
            companyId={company.id}
            filters={filters}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
            onReset={() => setFilters(DEFAULT)}
          />

          <PurchaseTable
            rows={data?.rows ?? []}
            total={data?.total ?? 0}
            isLoading={isLoading}
            page={filters.page}
            pageSize={filters.pageSize}
            onPageChange={(page) => setFilters((f) => ({ ...f, page }))}
            onMarkPending={(p) => handleStatus(p, "pending", "marcada como pendente")}
            onMarkReceived={(p) => handleStatus(p, "received", "marcada como recebida")}
            onCancel={(p) => handleStatus(p, "cancelled", "cancelada")}
            onDelete={handleDelete}
          />
        </TabsContent>

        <TabsContent value="insights" className="space-y-6 border-none p-0 outline-none">
          <PurchasesBellaHints companyId={company.id} />
          <BellaPurchasesPanel companyId={company.id} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
