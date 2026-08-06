import { useMemo, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { requirePermission } from "@/features/rbac";
import { Boxes, Plus, Scale, History, Lightbulb, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncMercadoLivreProducts } from "@/lib/mercadolivre.functions";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLayout } from "@/components/layout";
import {
  InventoryMetrics,
  MovementFormDialog,
  MovementsTable,
  MovementFilters,
  LowStockAlerts,
  StagnantProducts,
  useMovementsList,
  useInventoryMetrics,
  DEFAULT_MOVEMENT_FILTERS,
} from "@/features/inventory";
import type { MovementListFilters } from "@/features/inventory";
import { 
  ProductTable, 
  ProductFilters, 
  useProductsList,
  type ProductListFilters 
} from "@/features/products";
import { BellaInventoryPanel } from "@/features/accounting-ai/inventory";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useInterestSummary } from "@/features/interests";

export const Route = createFileRoute("/_authenticated/estoque")({
  beforeLoad: requirePermission("inventory.view"),
  component: InventoryPage,
});

const DEFAULT_PRODUCT_FILTERS: ProductListFilters = {
  search: "",
  categoryId: "all",
  supplierId: "all",
  status: "active",
  stock: "all",
  sortBy: "name",
  sortDir: "asc",
  page: 1,
  pageSize: 20,
};

function InventoryPage() {
  const { company } = Route.useRouteContext();
  const [openForm, setOpenForm] = useState(false);
  const queryClient = useQueryClient();

  const syncProductsMutation = useMutation({
    mutationFn: () => syncMercadoLivreProducts(),
    onSuccess: (data) => {
      toast.success(
        `Sincronização concluída: ${data.imported} novos produtos, ${data.updated} atualizados.`
      );
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (error: any) => {
      toast.error(`Falha ao sincronizar anúncios: ${error.message}`);
    },
  });
  
  // State para Aba 1 (Produtos)
  const [productFilters, setProductFilters] = useState<ProductListFilters>(DEFAULT_PRODUCT_FILTERS);
  const debouncedProductSearch = useDebouncedValue(productFilters.search, 300);
  const effectiveProductFilters = useMemo(
    () => ({ ...productFilters, search: debouncedProductSearch }),
    [productFilters, debouncedProductSearch],
  );

  // State para Aba 2 (Movimentações)
  const [movementFilters, setMovementFilters] = useState<MovementListFilters>(DEFAULT_MOVEMENT_FILTERS);
  const debouncedMovementSearch = useDebouncedValue(movementFilters.search, 300);
  const effectiveMovementFilters = useMemo(
    () => ({ ...movementFilters, search: debouncedMovementSearch }),
    [movementFilters, debouncedMovementSearch],
  );

  // Data fetching
  const products = useProductsList(company.id, effectiveProductFilters);
  const movements = useMovementsList(company.id, effectiveMovementFilters);
  const metrics = useInventoryMetrics(company.id);
  const { waitingByProduct } = useInterestSummary(company.id);

  return (
    <PageLayout
      icon={Boxes}
      title="Estoque"
      meta={`${metrics.data?.productCount ?? 0} produtos`}
      actions={
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-xl"
            onClick={() => syncProductsMutation.mutate()}
            disabled={syncProductsMutation.isPending}
          >
            <RefreshCw
              className={`mr-1.5 h-4 w-4 ${syncProductsMutation.isPending ? "animate-spin" : ""}`}
            />
            Importar ML
          </Button>
          <Button size="sm" variant="outline" asChild className="rounded-xl">
            <Link to="/estoque/reconciliacao">
              <Scale className="mr-1.5 h-4 w-4" /> Reconciliação
            </Link>
          </Button>
          <Button size="sm" onClick={() => setOpenForm(true)} className="rounded-xl">
            <Plus className="mr-1.5 h-4 w-4" /> Novo
          </Button>
        </div>
      }
      kpis={null}
    >
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="mb-4 border-b border-border bg-transparent w-full justify-start rounded-none h-auto p-0 gap-8">
          <TabsTrigger 
            value="overview"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-0 text-sm font-medium"
          >
            Visão Geral
          </TabsTrigger>
          <TabsTrigger 
            value="history"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-0 text-sm font-medium"
          >
            Histórico de Movimentações
          </TabsTrigger>
          <TabsTrigger 
            value="insights"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none py-2 px-0 text-sm font-medium"
          >
            Insights & Alertas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <ProductFilters
            companyId={company.id}
            filters={productFilters}
            onChange={(p) => setProductFilters((f) => ({ ...f, ...p }))}
            onReset={() => setProductFilters(DEFAULT_PRODUCT_FILTERS)}
          />
          <ProductTable
            rows={products.data?.rows ?? []}
            total={products.data?.total ?? 0}
            isLoading={products.isLoading}
            page={productFilters.page}
            pageSize={productFilters.pageSize}
            onPageChange={(page) => setProductFilters((f) => ({ ...f, page }))}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold text-muted-foreground">Extrato de Entradas e Saídas</h2>
            </div>
            <MovementFilters
              filters={movementFilters}
              onChange={(p) => setMovementFilters((f) => ({ ...f, ...p }))}
              onReset={() => setMovementFilters(DEFAULT_MOVEMENT_FILTERS)}
            />
          </div>
          <MovementsTable
            rows={movements.data?.rows ?? []}
            total={movements.data?.total ?? 0}
            isLoading={movements.isLoading}
            page={movementFilters.page}
            pageSize={movementFilters.pageSize}
            onPageChange={(page) => setMovementFilters((f) => ({ ...f, page }))}
          />
        </TabsContent>

        <TabsContent value="insights" className="space-y-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <LowStockAlerts
              items={metrics.data?.belowMin ?? []}
              waitingByProduct={waitingByProduct}
            />
            <StagnantProducts items={metrics.data?.stagnant ?? []} />
            <InventoryMetrics companyId={company.id} />
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Diagnóstico da Bella IA</h3>
            </div>
            <BellaInventoryPanel companyId={company.id} />
          </div>
        </TabsContent>
      </Tabs>

      <MovementFormDialog
        open={openForm}
        onOpenChange={setOpenForm}
        companyId={company.id}
      />
    </PageLayout>
  );
}
