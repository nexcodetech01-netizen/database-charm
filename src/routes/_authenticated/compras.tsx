import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Plus, ShoppingBag, Upload } from "lucide-react";
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
import { ImportOrderDialog } from "@/features/purchases/components/import-order-dialog";
import { PurchasesBellaHints } from "@/features/bella-ai";
import { BellaPurchasesPanel } from "@/features/accounting-ai/purchases";
import type { PurchaseListFilters, PurchaseWithMeta, PurchaseItemDraft } from "@/features/purchases";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useNextAction } from "@/components/feedback/next-action-provider";
import { useNavigate } from "@tanstack/react-router";

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
  const navigate = useNavigate();
  const [filters, setFilters] = useState<PurchaseListFilters>(DEFAULT);
  const [importOpen, setImportOpen] = useState(false);
  
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

  const handleImportSuccess = (items: PurchaseItemDraft[]) => {
    // Armazenamos temporariamente os itens no sessionStorage para a tela de novo pedido
    sessionStorage.setItem('nexos_pending_purchase_import', JSON.stringify(items));
    navigate({ to: "/compras/novo" });
  };

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
      meta={`${metrics.data?.monthCount ?? 0} pedidos no mês`}
      actions={
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-1.5 h-4 w-4" /> Importar Pedido (PDF)
          </Button>
          <Button size="sm" asChild>
            <Link to="/compras/novo">
              <Plus className="mr-1.5 h-4 w-4" /> Nova compra
            </Link>
          </Button>
        </div>
      }
      kpis={null}
    >
      <ImportOrderDialog 
        open={importOpen} 
        onOpenChange={setImportOpen} 
        companyId={company.id} 
        onImport={handleImportSuccess}
      />
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
          </TabsTrigger>
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
          <PurchasesBellaHints companyId={company.id} />
          <BellaPurchasesPanel companyId={company.id} />
        </TabsContent>
      </Tabs>
    </PageLayout>
  );
}
